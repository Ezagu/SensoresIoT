-- ====================================================================
-- 0. EXTENSIÓN TIMESCALEDB (necesaria antes de poder usar create_hypertable)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ====================================================================
-- 1. USUARIOS
-- ====================================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password        TEXT NOT NULL,
    rol             TEXT NOT NULL DEFAULT 'user' CHECK (rol IN ('user', 'admin')),
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 2. DISPOSITIVOS (placas ESP32)
-- ====================================================================
CREATE TABLE dispositivos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              TEXT NOT NULL,
    ubicacion           TEXT,
    descripcion         TEXT,
    activo              BOOLEAN NOT NULL DEFAULT true,
    secret_hash         TEXT NOT NULL,
    last_seen_at        TIMESTAMPTZ,
    first_connected_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
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

CREATE TABLE verificaciones_email (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID REFERENCES usuarios(id) NOT NULL,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

SELECT create_hypertable('mediciones', 'time');

CREATE INDEX idx_mediciones_sensor_time
    ON mediciones (sensor_id, time DESC);

-- POBLAR LAS TABLAS

-- 1. Un tipo de sensor
INSERT INTO tipos_sensor (nombre, unidad, valor_min, valor_max)
VALUES ('temperatura', '°C', -10, 50);

-- 2. Un usuario dueño
INSERT INTO usuarios (nombre, email, password)
VALUES ('Test User', 'test@test.com', 'hasheado_dummy')
RETURNING id;
-- copiá el id que te devuelve y pegalo abajo en \gset o a mano

-- 3. Un dispositivo (reemplazá el UUID del usuario)
INSERT INTO dispositivos (usuario_id, nombre, ubicacion)
VALUES ('67cb4055-5ca5-4718-8819-d5be28572fe1', 'Placa Lote Norte', 'Campo A')
RETURNING id;

-- 4. Un sensor en ese dispositivo (reemplazá el UUID del dispositivo)
INSERT INTO sensores (dispositivo_id, tipo_sensor_id, nombre)
VALUES ('9907a9d6-4378-48ac-85ce-99f34a03d106', 1, 'Sensor Temp 1')
RETURNING id;

-- 5. Mediciones de prueba (reemplazá el UUID del sensor)
INSERT INTO mediciones (time, sensor_id, value)
SELECT
  now() - (i || ' minutes')::interval,
  '838de415-964b-41be-86bc-ffff51f7f070',
  20 + 5 * sin(i / 10.0)  -- valores que oscilan, simulando temperatura real
FROM generate_series(0, 500) AS i;