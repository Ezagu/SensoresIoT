-- ====================================================================
-- 009 — La preferencia de notificación pasa a ser del dispositivo
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/009_notificaciones_por_dispositivo.sql
--
-- Nadie quiere el mail de "temperatura > 30" pero sí el de "temperatura < 5"
-- del mismo equipo: quiere o no quiere que ese equipo le escriba. La
-- preferencia sigue siendo de cada usuario, sólo cambia de granularidad.
--
-- Va en usuario_dispositivo y no en una tabla aparte: esa tabla YA es "todos
-- los que tienen acceso al equipo", que es exactamente el conjunto de
-- destinatarios, y la fila ya existe desde el vínculo — el DEFAULT hace el
-- trabajo que hacía el COALESCE del opt-out.
-- ====================================================================

ALTER TABLE usuario_dispositivo
    ADD COLUMN IF NOT EXISTS notificar BOOLEAN NOT NULL DEFAULT true;

-- Quien había silenciado TODAS las alertas de un equipo queda silenciado en el
-- equipo; con una sola activa, sigue recibiendo.
DO $$
BEGIN
    IF to_regclass('alerta_preferencias') IS NOT NULL THEN
        UPDATE usuario_dispositivo ud SET notificar = false
        WHERE EXISTS (
            SELECT 1 FROM alertas a
            JOIN sensores s ON s.id = a.sensor_id
            WHERE s.dispositivo_id = ud.dispositivo_id
        )
        AND NOT EXISTS (
            SELECT 1 FROM alertas a
            JOIN sensores s ON s.id = a.sensor_id
            LEFT JOIN alerta_preferencias p
                   ON p.alerta_id = a.id AND p.usuario_id = ud.usuario_id
            WHERE s.dispositivo_id = ud.dispositivo_id AND COALESCE(p.notificar, true)
        );
    END IF;
END $$;

DROP TABLE IF EXISTS alerta_preferencias;
