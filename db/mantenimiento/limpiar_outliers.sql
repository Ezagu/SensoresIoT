-- DESTRUCTIVO. Borra del raw los picos que marca detectar_outliers.sql y
-- re-materializa los agregados sobre la ventana afectada.
--
-- Lo segundo no es opcional: las políticas de refresh usan start_offset de 3 d
-- (horario) y 30 d (diario), así que un pico más viejo que eso queda invalidado
-- pero nunca se vuelve a materializar. El raw se borra a los 90 días; el
-- agregado diario dura para siempre, y el pico con él.
--
--   1) revisar:  ... -f - < db/mantenimiento/detectar_outliers.sql
--   2) borrar:   ... -f - < db/mantenimiento/limpiar_outliers.sql
--
-- Correrlo más de una vez: al sacar un pico cambian los vecinos del de al lado,
-- así que una ráfaga puede necesitar dos pasadas. Los mismos parámetros que
-- detectar_outliers.sql, y conviene usar exactamente los que se revisaron.

\if :{?desvio}  \else \set desvio 100 \endif
\if :{?vecinos} \else \set vecinos 50 \endif

CREATE TEMP TABLE outliers AS
WITH vecinos AS (
    SELECT sensor_id, time, value,
           lag(value)  OVER w AS prev,
           lead(value) OVER w AS next
    FROM mediciones
    WINDOW w AS (PARTITION BY sensor_id ORDER BY time)
), escala AS (
    SELECT sensor_id,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(value - prev)) AS paso
    FROM vecinos
    WHERE prev IS NOT NULL
    GROUP BY sensor_id
)
SELECT v.sensor_id, v.time, v.value
FROM vecinos v
JOIN escala e USING (sensor_id)
WHERE v.prev IS NOT NULL AND v.next IS NOT NULL AND e.paso > 0
  AND sign(v.value - v.prev) = sign(v.value - v.next)
  AND least(abs(v.value - v.prev), abs(v.value - v.next)) > :desvio * e.paso
  AND abs(v.prev - v.next) < :vecinos * e.paso;

SELECT count(*) AS lecturas_a_borrar FROM outliers;

DELETE FROM mediciones m
USING outliers o
WHERE m.sensor_id = o.sensor_id AND m.time = o.time;

SELECT (count(*) > 0)::text                            AS hubo_borrado,
       date_trunc('day', min(time))                    AS ini,
       date_trunc('day', max(time)) + interval '1 day' AS fin
FROM outliers \gset

\if :hubo_borrado
    \echo 'Re-materializando agregados sobre la ventana afectada...'
    CALL refresh_continuous_aggregate('mediciones_por_hora', :'ini', :'fin');
    CALL refresh_continuous_aggregate('mediciones_por_dia',  :'ini', :'fin');
\else
    \echo 'Nada que borrar.'
\endif

DROP TABLE outliers;
