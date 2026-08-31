-- ====================================================================
-- 008 — Quitar el rango físico de tipos_sensor y el tope por sensor en alertas
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/008_quitar_umbrales_tipo_sensor.sql
--
-- valor_min/valor_max nunca tuvieron más consumidor que la validación de
-- umbral en alerta_service.crear_alerta, y esa validación se saca: el límite
-- de alertas pasa a resolverse enteramente por dispositivo (max_alertas del
-- plan), no por sensor.
-- ====================================================================

ALTER TABLE tipos_sensor DROP COLUMN IF EXISTS valor_min;
ALTER TABLE tipos_sensor DROP COLUMN IF EXISTS valor_max;
