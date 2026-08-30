-- ====================================================================
-- 005 — Exportar historial (Tier 4.2): no es una feature de plan
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/005_export_habilitado.sql
--
-- puede_exportar quedó en false para free desde que se creó el catálogo
-- (003_planes_suscripciones.sql), pero exportar terminó definiéndose como algo
-- que cualquier usuario puede hacer — lo único que lo limita es la misma
-- ventana de retención que ya recorta /grafico y /historial. La columna sigue
-- viva como palanca futura (por ejemplo, limitar frecuencia de export).
-- ====================================================================

UPDATE planes SET puede_exportar = true WHERE id IN ('free', 'premium');
