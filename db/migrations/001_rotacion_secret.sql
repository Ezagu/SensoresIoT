-- ====================================================================
-- 001 — Rotación de secret device-initiated (Tier 3.2)
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/001_rotacion_secret.sql
--
-- secret_hash_anterior: durante una rotación conviven dos secrets válidos.
-- El viejo se borra recién cuando el dispositivo se autentica con el nuevo
-- (commit implícito), para que una respuesta perdida no deje el equipo sin
-- forma de reautenticarse.
-- ====================================================================

ALTER TABLE dispositivos
    ADD COLUMN IF NOT EXISTS secret_hash_anterior TEXT,
    ADD COLUMN IF NOT EXISTS rotacion_pendiente   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS secret_rotado_at     TIMESTAMPTZ;
