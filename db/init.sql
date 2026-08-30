-- ====================================================================
-- 0. EXTENSIÓN TIMESCALEDB (necesaria antes de poder usar create_hypertable)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;
-- btree_gist: GiST no indexa `=` sobre UUID por su cuenta, y lo necesita el
-- EXCLUDE de suscripciones (sección 7).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ====================================================================
-- 1. USUARIOS
-- ====================================================================
CREATE TABLE usuarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre           TEXT NOT NULL,
    email            TEXT NOT NULL UNIQUE,
    password         TEXT NOT NULL,
    rol              TEXT NOT NULL DEFAULT 'user' CHECK (rol IN ('user', 'admin')),
    is_verified      BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    intentos_fallido INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta  TIMESTAMPTZ NULL
);

-- ====================================================================
-- 2. DISPOSITIVOS (placas ESP32)
-- ====================================================================
CREATE TABLE dispositivos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                TEXT NOT NULL,
    ubicacion             TEXT,
    descripcion           TEXT,
    activo                BOOLEAN NOT NULL DEFAULT true,
    secret_hash           TEXT NOT NULL,
    -- Durante una rotación conviven dos secrets válidos. El viejo se borra
    -- recién cuando el dispositivo se autentica con el nuevo (commit implícito),
    -- para que una respuesta perdida no deje el equipo sin forma de reautenticarse.
    secret_hash_anterior  TEXT,
    rotacion_pendiente    BOOLEAN NOT NULL DEFAULT false,
    secret_rotado_at      TIMESTAMPTZ,
    last_seen_at          TIMESTAMPTZ,
    first_connected_at    TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuario_dispositivo (
    usuario_id         UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    dispositivo_id     UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    rol                TEXT NOT NULL DEFAULT 'owner' CHECK (rol IN ('owner', 'viewer', 'editor')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, dispositivo_id)
);

CREATE UNIQUE INDEX idx_un_solo_owner 
ON usuario_dispositivo (dispositivo_id) 
WHERE rol = 'owner';
-- ====================================================================
-- 3. TIPOS DE SENSOR (catálogo)
-- ====================================================================
CREATE TABLE tipos_sensor (
    id                  SERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL UNIQUE,
    unidad              TEXT NOT NULL,
    valor_min           NUMERIC,
    valor_max           NUMERIC
);

-- ====================================================================
-- 4. SENSORES
-- ====================================================================
CREATE TABLE sensores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_id  UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    tipo_sensor_id  INT NOT NULL REFERENCES tipos_sensor(id),
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 5. MEDICIONES (hypertable)
-- ====================================================================
CREATE TABLE mediciones (
    time        TIMESTAMPTZ NOT NULL,
    sensor_id   UUID NOT NULL,   -- sin FK real (recomendación Timescale)
    value       DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('mediciones', 'time');

CREATE MATERIALIZED VIEW mediciones_por_hora
WITH (timescaledb.continuous) AS
SELECT
    sensor_id,
    time_bucket('1 hour', time) AS bucket,
    avg(value) AS promedio,
    min(value) AS minimo,
    max(value) AS maximo,
    count(*) AS cantidad
FROM mediciones
GROUP BY sensor_id, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW mediciones_por_dia
WITH (timescaledb.continuous) AS
SELECT
    sensor_id,
    time_bucket('1 day', time) AS bucket,
    avg(value) AS promedio,
    min(value) AS minimo,
    max(value) AS maximo,
    count(*) AS cantidad
FROM mediciones
GROUP BY sensor_id, bucket
WITH NO DATA;

-- start_offset holgado a propósito: el firmware bufferea lecturas mientras no tiene
-- red y las manda con su timestamp original cuando vuelve. Si esa fila cae fuera de la
-- ventana de refresh, Timescale registra la invalidación pero la policy nunca la
-- procesa y el dato queda afuera del agregado PARA SIEMPRE (el raw lo tiene, pero
-- medicion_repo._elegir_fuente manda cualquier rango > ~7 h al agregado horario).
-- La ventana tiene que cubrir el horizonte máximo del buffer del ESP con margen.
-- Costo: sólo se recomputan los buckets marcados como invalidados, no toda la ventana.
SELECT add_continuous_aggregate_policy('mediciones_por_hora',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '30 minutes');

SELECT add_continuous_aggregate_policy('mediciones_por_dia',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '3 hours');

-- Único: el ESP reintenta el mismo chunk del buffer si se pierde la respuesta del
-- POST, y el insert es ON CONFLICT DO NOTHING contra este índice. Sirve además como
-- el índice de lectura por sensor+tiempo (el UNIQUE no cambia cómo se recorre).
CREATE UNIQUE INDEX idx_mediciones_sensor_time ON mediciones (sensor_id, time DESC);
CREATE INDEX idx_mediciones_hora_sensor_bucket ON mediciones_por_hora (sensor_id, bucket DESC);
CREATE INDEX idx_mediciones_dia_sensor_bucket ON mediciones_por_dia (sensor_id, bucket DESC);

-- Raw: se dropea a los 90 días
SELECT add_retention_policy('mediciones', INTERVAL '90 days', if_not_exists => true);

-- Continuous aggregate horario: se dropea al año
SELECT add_retention_policy('mediciones_por_hora', INTERVAL '1 year', if_not_exists => true);

-- mediciones_por_dia: sin policy, retención indefinida

-- ====================================================================
-- 6. TOKENS
-- ====================================================================

CREATE TABLE verificaciones_email (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID REFERENCES usuarios(id) NOT NULL,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_token (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID REFERENCES usuarios(id) NOT NULL,
    token_hash  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revocado    BOOLEAN NOT NULL DEFAULT false,
    revocado_at TIMESTAMPTZ
);

-- ====================================================================
-- 7. PLANES Y SUSCRIPCIONES
-- ====================================================================
-- id es TEXT y no SERIAL/UUID porque el código referencia 'free' como literal
-- estable (es el fallback de falla cerrada); un id numérico que signifique free
-- se rompe con cualquier reseed.
--
-- NULL = ilimitado en dispositivos_incluidos, retencion_dias y max_alertas.
CREATE TABLE planes (
    id                     TEXT PRIMARY KEY,
    nombre                 TEXT NOT NULL,
    dispositivos_incluidos INTEGER,
    retencion_dias         INTEGER,
    intervalo_minimo_seg   INTEGER NOT NULL,
    puede_alertas          BOOLEAN NOT NULL DEFAULT false,
    max_alertas            INTEGER,
    puede_compartir        BOOLEAN NOT NULL DEFAULT false,
    puede_exportar         BOOLEAN NOT NULL DEFAULT false,
    activo                 BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La vigencia de una suscripción es 100% temporal:
--   inicio_at <= now() AND (fin_at IS NULL OR fin_at > now())
-- `estado` guarda la intención y NUNCA participa de ese predicado. Así "canceló
-- el día 3 pero pagó hasta el 30" sale gratis: cancelar sólo escribe
-- estado = 'cancelada' y no toca fin_at. No existe estado 'vencida' porque
-- obligaría a un job que actualice filas y abriría la posibilidad de que el
-- estado mienta respecto de las fechas.
--
-- Free es la ausencia de suscripción vigente, no una fila: nadie recibe una
-- suscripción al registrarse.
CREATE TABLE suscripciones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    plan_id      TEXT NOT NULL REFERENCES planes(id),
    estado       TEXT NOT NULL DEFAULT 'activa'
                 CHECK (estado IN ('activa', 'cancelada', 'revocada')),
    inicio_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin_at       TIMESTAMPTZ,
    cancelada_at TIMESTAMPTZ,
    origen       TEXT NOT NULL DEFAULT 'admin',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (fin_at IS NULL OR fin_at >= inicio_at)
);

-- El 409 del servicio es un check-then-act: dos requests concurrentes pueden ver
-- "sin vigente" las dos e insertar las dos, dejando al usuario con dos premium a
-- la vez (y revocar una no lo baja). Esto lo corta en la base.
--
-- tstzrange(inicio_at, fin_at) es semiabierto [): incluye el inicio, excluye el
-- fin, y fin_at NULL es infinito. Por eso revocar con fin_at = now() y reasignar
-- con inicio_at = now() no colisiona: los rangos se tocan pero no se solapan.
ALTER TABLE suscripciones
    ADD CONSTRAINT suscripciones_sin_solapamiento
    EXCLUDE USING gist (usuario_id WITH =, tstzrange(inicio_at, fin_at) WITH &&);

CREATE INDEX idx_suscripciones_usuario ON suscripciones (usuario_id, inicio_at DESC);

-- Ningún plan limita cantidad de dispositivos: la diferenciación es por features.
-- dispositivos_incluidos queda para el futuro, NULL en ambos.
INSERT INTO planes (id, nombre, dispositivos_incluidos, retencion_dias, intervalo_minimo_seg,
                    puede_alertas, max_alertas, puede_compartir, puede_exportar)
VALUES ('free',    'Free',    NULL, 7,    60, false, 0,    false, false),
       ('premium', 'Premium', NULL, NULL, 15, true,  NULL, true,  true);