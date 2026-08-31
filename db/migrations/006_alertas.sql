-- ====================================================================
-- 006 — Alertas por umbral (Tier 4.3)
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/006_alertas.sql
--
-- planes.puede_alertas / max_alertas ya existen desde 003_planes_suscripciones.sql
-- (free=false/0, premium=true/NULL): esta migración sólo agrega las tablas que
-- por fin las consumen, no toca el catálogo.
-- ====================================================================

CREATE TABLE IF NOT EXISTS alertas (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id             UUID NOT NULL REFERENCES sensores(id) ON DELETE CASCADE,
    usuario_id            UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre                TEXT,
    condicion             TEXT NOT NULL CHECK (condicion IN ('mayor', 'menor')),
    umbral                DOUBLE PRECISION NOT NULL,
    histeresis            DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (histeresis >= 0),
    activa                BOOLEAN NOT NULL DEFAULT true,
    -- Estado de la máquina normal/disparada: la evaluación es stateless por
    -- request, así que la transición sólo se puede detectar si se persiste.
    estado                TEXT NOT NULL DEFAULT 'normal' CHECK (estado IN ('normal', 'disparada')),
    estado_desde          TIMESTAMPTZ,
    ultimo_valor          DOUBLE PRECISION,
    -- `time` de la última lectura evaluada (no now()): evita reevaluar una
    -- lectura dos veces y evita que un lote desordenado retroceda el estado.
    ultima_evaluacion_at  TIMESTAMPTZ,
    ultima_notificacion_at TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_sensor_activa ON alertas (sensor_id) WHERE activa;
CREATE INDEX IF NOT EXISTS idx_alertas_usuario ON alertas (usuario_id);

CREATE TABLE IF NOT EXISTS alerta_eventos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alerta_id     UUID NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL CHECK (tipo IN ('disparada', 'normalizada')),
    valor         DOUBLE PRECISION NOT NULL,
    medicion_at   TIMESTAMPTZ NOT NULL,  -- `time` de la lectura que causó la transición
    detectado_at  TIMESTAMPTZ NOT NULL,  -- cuándo la evaluó el backend
    tardio        BOOLEAN NOT NULL DEFAULT false,
    notificado    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerta_eventos_alerta ON alerta_eventos (alerta_id, medicion_at DESC);
