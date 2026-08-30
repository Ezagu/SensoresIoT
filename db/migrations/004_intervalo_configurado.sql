-- ====================================================================
-- 004 — Intervalo de muestreo configurable por dispositivo
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/004_intervalo_configurado.sql
--
-- El piso del plan (planes.intervalo_minimo_seg) deja de ser el valor que se le
-- pide al dispositivo: pasa a ser un mínimo sobre el que el dueño puede elegir
-- medir más lento (autonomía de batería/buffer). NULL = automático, usa el piso
-- vigente en cada momento; un valor propio nunca se pisa por un downgrade de
-- plan, sólo deja de cumplirse hasta que el owner vuelva a subir de plan — el
-- clamp se aplica en tiempo de request, no al guardar.
-- ====================================================================

ALTER TABLE dispositivos
    ADD COLUMN IF NOT EXISTS intervalo_configurado_seg INTEGER
    CHECK (intervalo_configurado_seg IS NULL OR intervalo_configurado_seg > 0);
