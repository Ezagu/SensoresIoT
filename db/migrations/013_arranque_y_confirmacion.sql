-- 1. first_connected_at era el único TIMESTAMP sin zona de la base. Comparado
--    contra un datetime aware de Python revienta, y lo necesita el arranque
--    rápido. Lo escribió siempre actualizar_conexion() con hora UTC, así que
--    interpretarlo como UTC es exacto, no una aproximación.
--
-- 2. muestras_confirmacion se capeaba en 20, pero el firmware sólo guarda
--    VENTANA_MUESTRAS (8) por sensor: una regla con 12 pedía muestras que el
--    equipo no tiene. El tope de los dos lados tiene que ser el mismo.
--
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/013_arranque_y_confirmacion.sql

ALTER TABLE dispositivos
    ALTER COLUMN first_connected_at TYPE TIMESTAMPTZ
    USING first_connected_at AT TIME ZONE 'UTC';

UPDATE alertas SET muestras_confirmacion = 8 WHERE muestras_confirmacion > 8;

ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_muestras_confirmacion_check;
ALTER TABLE alertas
    ADD CONSTRAINT alertas_muestras_confirmacion_check
    CHECK (muestras_confirmacion BETWEEN 1 AND 8);
