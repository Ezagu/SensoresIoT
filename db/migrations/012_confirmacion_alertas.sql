-- Confirmación por persistencia: una regla transiciona recién cuando la
-- condición se cumple en N lecturas seguidas, no en la primera.
--
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/012_confirmacion_alertas.sql

ALTER TABLE alertas
    ADD COLUMN IF NOT EXISTS muestras_confirmacion INTEGER NOT NULL DEFAULT 3,
    -- Contador vivo: la evaluación es stateless por request, así que sin
    -- persistirlo un lote que corta al medio empieza a contar de cero.
    ADD COLUMN IF NOT EXISTS cruces_consecutivos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE alertas
    DROP CONSTRAINT IF EXISTS alertas_muestras_confirmacion_check;

ALTER TABLE alertas
    ADD CONSTRAINT alertas_muestras_confirmacion_check
    CHECK (muestras_confirmacion BETWEEN 1 AND 20);
