-- ====================================================================
-- 014 — Aviso de "el equipo dejó de reportar" (Tier 4.3.b)
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/014_aviso_sin_reportar.sql
--
-- alerta_eventos pasa a ser el registro de avisos DEL EQUIPO y no sólo de sus
-- reglas: dos formas en una tabla, discriminadas por `tipo`. Un solo log, un
-- solo cursor, una sola pantalla.
--
-- Además arregla dos defectos del registro que esta misma forma habilita:
--   1. Los listados joineaban `alertas` para leer nombre/condicion/umbral, así
--      que un evento viejo se mostraba contra el umbral de HOY. Editar una regla
--      reescribía el pasado. Ahora el evento guarda el snapshot de cómo era la
--      regla cuando pasó.
--   2. alerta_id era ON DELETE CASCADE: borrar una regla borraba su historial,
--      mientras la UI prometía lo contrario.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. Caída abierta del equipo
-- --------------------------------------------------------------------
-- Guarda el last_seen_at CONGELADO al detectar la caída, no el instante de
-- detección: cuando el equipo vuelve, last_seen_at ya fue pisado por el POST, y
-- así el mail de recuperación sabe cuánto duró el corte sin una query extra.
-- NULL = no hay caída abierta, y es también el candado que evita un mail por
-- minuto mientras dure.
ALTER TABLE dispositivos ADD COLUMN IF NOT EXISTS sin_reportar_desde TIMESTAMPTZ;

-- --------------------------------------------------------------------
-- 2. Las columnas de la forma nueva
-- --------------------------------------------------------------------
ALTER TABLE alerta_eventos
    ADD COLUMN IF NOT EXISTS dispositivo_id     UUID,
    -- Snapshot de la regla al momento del evento. No se joinea nunca.
    ADD COLUMN IF NOT EXISTS alerta_nombre      TEXT,
    ADD COLUMN IF NOT EXISTS condicion          TEXT,
    ADD COLUMN IF NOT EXISTS umbral             DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS tipo_sensor_nombre TEXT,
    ADD COLUMN IF NOT EXISTS tipo_sensor_unidad TEXT,
    -- Sólo las dos formas de conectividad: desde cuándo dura el silencio.
    ADD COLUMN IF NOT EXISTS silencio_desde     TIMESTAMPTZ;

-- --------------------------------------------------------------------
-- 3. Backfill
-- --------------------------------------------------------------------
-- alerta_id es NOT NULL hoy y toda la cadena hasta dispositivos también, así que
-- esto cubre el 100% de las filas y el SET NOT NULL de abajo no puede fallar.
-- El snapshot histórico se llena con el umbral ACTUAL de cada regla: es lo único
-- que existe, y no es peor que el JOIN que los listados hacían hasta hoy.
UPDATE alerta_eventos e
SET dispositivo_id     = s.dispositivo_id,
    alerta_nombre      = a.nombre,
    condicion          = a.condicion,
    umbral             = a.umbral,
    tipo_sensor_nombre = ts.nombre,
    tipo_sensor_unidad = ts.unidad
FROM alertas a
JOIN sensores s      ON s.id = a.sensor_id
JOIN tipos_sensor ts ON ts.id = s.tipo_sensor_id
WHERE a.id = e.alerta_id;

ALTER TABLE alerta_eventos
    ALTER COLUMN dispositivo_id SET NOT NULL;

ALTER TABLE alerta_eventos
    ADD CONSTRAINT alerta_eventos_dispositivo_id_fkey
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 4. Lo que deja de aplicar a un evento de conectividad
-- --------------------------------------------------------------------
ALTER TABLE alerta_eventos ALTER COLUMN alerta_id DROP NOT NULL;
ALTER TABLE alerta_eventos ALTER COLUMN valor     DROP NOT NULL;

-- El historial es del equipo, no de la regla: borrar "temp > 30" no puede borrar
-- el hecho de que la heladera se fue a 34° el martes. Con el snapshot, el evento
-- se sigue leyendo entero sin la regla.
ALTER TABLE alerta_eventos DROP CONSTRAINT IF EXISTS alerta_eventos_alerta_id_fkey;
ALTER TABLE alerta_eventos
    ADD CONSTRAINT alerta_eventos_alerta_id_fkey
    FOREIGN KEY (alerta_id) REFERENCES alertas(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 5. Tipos y consistencia entre las dos formas
-- --------------------------------------------------------------------
ALTER TABLE alerta_eventos DROP CONSTRAINT IF EXISTS alerta_eventos_tipo_check;
ALTER TABLE alerta_eventos
    ADD CONSTRAINT alerta_eventos_tipo_check
    CHECK (tipo IN ('disparada', 'normalizada', 'sin_reportar', 'reconectado'));

-- El discriminador es `tipo` y NO `alerta_id IS NULL`: el SET NULL de arriba deja
-- eventos de regla sin alerta_id cuando alguien borra la regla. Por eso la rama
-- de regla no puede exigir alerta_id IS NOT NULL, y la de conectividad sí puede
-- exigir alerta_id IS NULL (nada se lo escribe nunca). La asimetría es a propósito.
ALTER TABLE alerta_eventos
    ADD CONSTRAINT alerta_eventos_forma CHECK (
        CASE WHEN tipo IN ('sin_reportar', 'reconectado') THEN
            alerta_id IS NULL AND valor IS NULL AND alerta_nombre IS NULL
            AND condicion IS NULL AND umbral IS NULL
            AND tipo_sensor_nombre IS NULL AND tipo_sensor_unidad IS NULL
            AND silencio_desde IS NOT NULL
        ELSE
            valor IS NOT NULL AND condicion IS NOT NULL AND umbral IS NOT NULL
            AND tipo_sensor_nombre IS NOT NULL AND tipo_sensor_unidad IS NOT NULL
            AND silencio_desde IS NULL
        END
    );

ALTER TABLE alerta_eventos
    ADD CONSTRAINT alerta_eventos_condicion_check
    CHECK (condicion IS NULL OR condicion IN ('mayor', 'menor'));

-- --------------------------------------------------------------------
-- 6. Índices
-- --------------------------------------------------------------------
-- Parcial: el ON DELETE SET NULL mete NULLs, que btree indexa igual y que
-- `alerta_id = %s` no puede matchear nunca. El planner deduce que el filtro
-- implica IS NOT NULL, así que la query de listar_eventos_por_alerta no cambia.
DROP INDEX IF EXISTS idx_alerta_eventos_alerta;
CREATE INDEX idx_alerta_eventos_alerta ON alerta_eventos (alerta_id, medicion_at DESC)
    WHERE alerta_id IS NOT NULL;

-- Los listados por equipo y el log global ahora filtran por acá.
CREATE INDEX IF NOT EXISTS idx_alerta_eventos_dispositivo
    ON alerta_eventos (dispositivo_id, medicion_at DESC);

-- --------------------------------------------------------------------
-- 7. Semilla anti-avalancha
-- --------------------------------------------------------------------
-- Los equipos que ya estaban caídos antes de que la feature existiera arrancan
-- con la caída ABIERTA: el primer barrido no encuentra nada que abrir y nadie
-- recibe una tanda de mails por cortes viejos. 90 min = 3 x el intervalo más
-- grande configurable (1800 s), o sea el peor caso posible de esta_online: por
-- encima de eso el equipo está caído bajo cualquier plan, así que el candado
-- nunca queda puesto sobre un equipo sano.
UPDATE dispositivos
SET sin_reportar_desde = last_seen_at
WHERE activo AND last_seen_at IS NOT NULL
  AND last_seen_at < now() - interval '90 minutes';

COMMIT;
