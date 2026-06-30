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
    rol             TEXT NOT NULL DEFAULT 'viewer',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 2. DISPOSITIVOS (placas ESP32)
-- ====================================================================
CREATE TABLE dispositivos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    codigo          TEXT NOT NULL UNIQUE,
    nombre          TEXT NOT NULL,
    ubicacion       TEXT,
    descripcion     TEXT,
    activo          BOOLEAN NOT NULL DEFAULT true,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    nombre          TEXT,
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

CREATE INDEX idx_mediciones_sensor_time
    ON mediciones (sensor_id, time DESC);