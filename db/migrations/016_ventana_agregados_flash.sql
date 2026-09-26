-- ====================================================================
-- 016 — Ventana de refresh de los agregados: 85 días
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/016_ventana_agregados_flash.sql
--
-- El firmware a batería vuelca a flash lo que no pudo enviar y lo manda al volver
-- la conexión, con semanas o meses de atraso. Una fila que cae fuera de
-- start_offset no entra nunca al agregado (ver 002), así que la ventana tiene que
-- cubrir ese horizonte.
--
-- 85 y no 90 (ANTIGUEDAD_MAXIMA): el raw se borra a los 90 días, y refrescar un
-- tramo sin raw lo recalcula vacío y borra las filas del agregado. Lo que llegue
-- con 85–90 días de atraso queda sólo en el raw.
-- El costo de refresh no escala con la ventana: sólo se recomputan los buckets
-- invalidados.
-- ====================================================================

SELECT remove_continuous_aggregate_policy('mediciones_por_hora', if_exists => true);
SELECT add_continuous_aggregate_policy('mediciones_por_hora',
    start_offset => INTERVAL '85 days',
    end_offset => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '30 minutes');

SELECT remove_continuous_aggregate_policy('mediciones_por_dia', if_exists => true);
SELECT add_continuous_aggregate_policy('mediciones_por_dia',
    start_offset => INTERVAL '85 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '3 hours');
