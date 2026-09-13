-- Picos aislados: una lectura que se desvía de AMBOS vecinos en la misma
-- dirección. Es la firma de un frame I2C corrupto, no la de un cambio real
-- (un cambio real coincide con uno de los dos vecinos).
--
-- La escala es la mediana del salto entre lecturas consecutivas de ESE sensor,
-- así el criterio no depende de la unidad y sirve igual para ºC, % o hPa.
--
--   docker compose exec -T timescaledb psql -U postgres \
--     -v desvio=100 -v vecinos=50 -f - < db/mantenimiento/detectar_outliers.sql
--
-- desvio  : cuántos pasos típicos tiene que apartarse de los dos vecinos.
-- vecinos : cuánto pueden diferir los vecinos ENTRE SÍ. Acotarlo evita marcar
--           una lectura sana que quedó entre dos corruptas — pasa en ráfagas,
--           y por eso conviene correr detectar/limpiar más de una vez.

\if :{?desvio}  \else \set desvio 100 \endif
\if :{?vecinos} \else \set vecinos 50 \endif

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
SELECT v.sensor_id,
       ts.nombre AS tipo,
       v.time,
       round(v.prev::numeric, 2)  AS prev,
       round(v.value::numeric, 2) AS valor,
       round(v.next::numeric, 2)  AS next,
       round(least(abs(v.value - v.prev), abs(v.value - v.next))::numeric / e.paso::numeric, 0) AS pasos_desvio
FROM vecinos v
JOIN escala e USING (sensor_id)
JOIN sensores s     ON s.id  = v.sensor_id
JOIN tipos_sensor ts ON ts.id = s.tipo_sensor_id
WHERE v.prev IS NOT NULL AND v.next IS NOT NULL AND e.paso > 0
  AND sign(v.value - v.prev) = sign(v.value - v.next)
  AND least(abs(v.value - v.prev), abs(v.value - v.next)) > :desvio * e.paso
  AND abs(v.prev - v.next) < :vecinos * e.paso
ORDER BY v.time;
