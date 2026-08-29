-- ====================================================================
-- 002 — Buffer de mediciones en el ESP32: inserts idempotentes + ventana
--       de refresh de los continuous aggregates
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/002_buffer_mediciones.sql
--
-- El firmware ahora guarda en RAM las lecturas que no pudo enviar y las manda
-- después con su timestamp original. Eso cambia dos supuestos de la base:
--
--   1. Un chunk reenviado puede haber entrado ya (respuesta perdida en el camino).
--      Sin índice único se duplicaría el punto y se inflarían los agregados.
--   2. Las filas llegan atrasadas horas. Timescale marca el bucket como
--      invalidado, pero la policy sólo recomputa lo que cae dentro de
--      start_offset: fuera de esa ventana el dato queda afuera del agregado
--      para siempre (el raw lo tiene, pero medicion_repo._elegir_fuente manda
--      cualquier rango > ~7 h al agregado horario, así que no se vería).
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Índice único (sensor_id, time)
-- --------------------------------------------------------------------

-- Limpieza previa: si quedaron duplicados de antes del índice, el CREATE falla.
-- tableoid + ctid porque la hypertable no tiene PK y el ctid solo no es único
-- entre chunks.
DELETE FROM mediciones m
USING (
    SELECT tableoid AS chunk, ctid AS fila
    FROM (
        SELECT tableoid, ctid,
               row_number() OVER (PARTITION BY sensor_id, time ORDER BY ctid) AS n
        FROM mediciones
    ) numeradas
    WHERE n > 1
) duplicadas
WHERE m.tableoid = duplicadas.chunk AND m.ctid = duplicadas.fila;

-- Reemplaza al índice de lectura por sensor+tiempo: mismas columnas, mismo orden,
-- no hace falta mantener dos.
DROP INDEX IF EXISTS idx_mediciones_sensor_time;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mediciones_sensor_time
    ON mediciones (sensor_id, time DESC);

-- --------------------------------------------------------------------
-- 2. Ventana de refresh de los agregados
-- --------------------------------------------------------------------
-- Tiene que cubrir el horizonte máximo del buffer del ESP (~12 h) con margen.
-- El costo de refresh no escala con la ventana: sólo se recomputan los buckets
-- marcados como invalidados.

SELECT remove_continuous_aggregate_policy('mediciones_por_hora', if_exists => true);
SELECT add_continuous_aggregate_policy('mediciones_por_hora',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '30 minutes',
    schedule_interval => INTERVAL '30 minutes');

SELECT remove_continuous_aggregate_policy('mediciones_por_dia', if_exists => true);
SELECT add_continuous_aggregate_policy('mediciones_por_dia',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '3 hours');

-- Si ya se habían perdido invalidaciones fuera de la ventana vieja, forzar una
-- recomputación completa (puede tardar; correr a mano si hace falta):
--   CALL refresh_continuous_aggregate('mediciones_por_hora', NULL, NULL);
--   CALL refresh_continuous_aggregate('mediciones_por_dia', NULL, NULL);
