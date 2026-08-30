-- ====================================================================
-- 003 — Planes y suscripciones (Tier 4.1)
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/003_planes_suscripciones.sql
--
-- Cimiento del modelo freemium. Esta migración NO aplica ningún límite: sólo
-- define de dónde salen. Los gates (retención, intervalo de muestreo, alertas,
-- compartir, exportar) se implementan después leyendo estas tablas a través de
-- services/plan_service.py, que es el único punto de consulta.
--
-- Dos decisiones que conviene entender antes de tocar esto:
--
--   1. La vigencia de una suscripción es 100% temporal. `estado` guarda la
--      intención (activa / cancelada / revocada) y NUNCA participa del
--      predicado de vigencia. Así "canceló el día 3 pero pagó hasta el 30"
--      sale gratis: cancelar no toca fin_at. No existe estado 'vencida'
--      porque obligaría a un job que actualice filas y abriría la posibilidad
--      de que el estado mienta respecto de las fechas.
--
--   2. Free es la ausencia de suscripción vigente, no una fila. Nadie recibe
--      una suscripción al registrarse.
-- ====================================================================

-- Necesaria para el EXCLUDE de más abajo: GiST no sabe indexar `=` sobre UUID
-- por su cuenta.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- --------------------------------------------------------------------
-- 1. Catálogo de planes
-- --------------------------------------------------------------------
-- id es TEXT y no SERIAL/UUID porque el código referencia 'free' como literal
-- estable (es el fallback de falla cerrada); un id numérico que signifique free
-- se rompe con cualquier reseed.
--
-- NULL = ilimitado en dispositivos_incluidos, retencion_dias y max_alertas.
CREATE TABLE IF NOT EXISTS planes (
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

-- --------------------------------------------------------------------
-- 2. Suscripciones
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suscripciones (
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
--
-- ADD CONSTRAINT no acepta IF NOT EXISTS, de ahí el bloque: el script tiene que
-- poder correrse dos veces como los anteriores. El chequeo va contra pg_constraint
-- y no con un EXCEPTION: un EXCLUDE crea además un índice con el mismo nombre, así
-- que el segundo intento falla con duplicate_table, no con duplicate_object.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suscripciones_sin_solapamiento') THEN
        ALTER TABLE suscripciones
            ADD CONSTRAINT suscripciones_sin_solapamiento
            EXCLUDE USING gist (usuario_id WITH =, tstzrange(inicio_at, fin_at) WITH &&);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_suscripciones_usuario
    ON suscripciones (usuario_id, inicio_at DESC);

-- --------------------------------------------------------------------
-- 3. Semilla del catálogo
-- --------------------------------------------------------------------
-- Ningún plan limita cantidad de dispositivos: la diferenciación es por
-- features. dispositivos_incluidos queda para el futuro, NULL en ambos.
INSERT INTO planes (id, nombre, dispositivos_incluidos, retencion_dias, intervalo_minimo_seg,
                    puede_alertas, max_alertas, puede_compartir, puede_exportar)
VALUES ('free',    'Free',    NULL, 7,    60, false, 0,    false, false),
       ('premium', 'Premium', NULL, NULL, 15, true,  NULL, true,  true)
ON CONFLICT (id) DO NOTHING;
