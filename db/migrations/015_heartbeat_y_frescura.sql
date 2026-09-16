-- ====================================================================
-- 015 — Heartbeat: la liveness deja de colgar de la cadencia de publicación
--
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/015_heartbeat_y_frescura.sql
--
-- El equipo pasa a hablar cada 5 min aunque no le toque publicar (POST con
-- `mediciones: []`). Así "está vivo" deja de derivarse de cada cuánto publica
-- —un número elegido por ancho de banda y filas en la base, no por qué tan
-- rápido querés enterarte de una falla— y pasa a ser 15 min para todos:
-- un equipo de 30 min se detectaba en 90 min y ahora en 15, y desaparece el
-- piso de 15 min que tapaba el extremo rápido (los equipos de 1 min se daban
-- por caídos a los 3 min, o sea en cada reinicio de router).
--
-- Efecto secundario que hay que cubrir: con heartbeat, last_seen_at deja de
-- significar "último dato". Un equipo con el bus I2C muerto sigue hablando y no
-- manda una lectura nunca más — leerSensores() valida contra el datasheet y una
-- lectura fallida no bufferea nada. Sin separar las dos cosas, el panel lo
-- mostraría "En línea" para siempre, que es la falla silenciosa entrando por la
-- puerta de atrás.
-- ====================================================================

BEGIN;

-- last_seen_at  = cuándo HABLÓ el equipo      -> ¿está vivo?      (15 min, fijo)
-- last_data_at  = cuándo MANDÓ DATOS          -> ¿llegan a tiempo? (1,5 x intervalo)
--
-- now() y no el `time` de la lectura, por el mismo motivo que last_seen_at: un
-- flush de datos viejos ES dato fluyendo.
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS last_data_at TIMESTAMPTZ;

-- Hasta hoy todo POST traía datos, así que el valor viejo vale para las dos.
UPDATE dispositivos SET last_data_at = last_seen_at WHERE last_data_at IS NULL;

-- El equipo se entera del intervalo nuevo recién en su próximo contacto, y hasta
-- entonces sigue publicando con el viejo: sin esto, cambiar de 5 min a 1 min
-- marca el equipo "con retraso" al instante, justo cuando quien lo cambió está
-- mirando la pantalla. El heartbeat acota esa ignorancia a 5 min para cualquier
-- transición, así que alcanza con saber CUÁNDO se cambió — no hace falta guardar
-- el valor anterior.
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS intervalo_modificado_at TIMESTAMPTZ;

COMMIT;
