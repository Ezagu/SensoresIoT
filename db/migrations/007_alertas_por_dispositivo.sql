-- ====================================================================
-- 007 — Alertas pasan a ser del dispositivo, no del usuario
--
-- Aplicar sobre bases ya existentes (db/init.sql sólo corre en volumen nuevo):
--   docker compose exec -T timescaledb psql -U postgres < db/migrations/007_alertas_por_dispositivo.sql
--
-- Una alerta protege un equipo compartido entre varias personas (owner/editor
-- la administran, viewer sólo ve), no una regla privada de quien la creó.
-- `alertas` y `alerta_eventos` están vacías en producción (006 recién se
-- aplicó), así que estos ALTER no tienen datos que migrar.
-- ====================================================================

ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_usuario_id_fkey;
ALTER TABLE alertas RENAME COLUMN usuario_id TO creado_por;
ALTER TABLE alertas ALTER COLUMN creado_por DROP NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'alertas_creado_por_fkey'
    ) THEN
        ALTER TABLE alertas ADD CONSTRAINT alertas_creado_por_fkey
            FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_alertas_usuario;
-- El índice parcial (WHERE activa) sigue sirviendo al hot path de evaluación;
-- éste sirve a los listados por dispositivo, que también muestran inactivas.
CREATE INDEX IF NOT EXISTS idx_alertas_sensor ON alertas (sensor_id);

-- Preferencia de notificación por usuario. Sin fila = notificar (opt-out):
-- si insertáramos una fila por usuario al crear la alerta, alguien a quien le
-- comparten el equipo después no recibiría nada hasta un backfill manual.
CREATE TABLE IF NOT EXISTS alerta_preferencias (
    alerta_id  UUID NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    notificar  BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (alerta_id, usuario_id)
);

-- Un evento ahora puede tener varios destinatarios (todos los que tienen
-- acceso al dispositivo, menos los que se dieron de baja): el booleano
-- notificado no alcanza para saber si el envío falló para alguno.
ALTER TABLE alerta_eventos DROP COLUMN IF EXISTS notificado;
ALTER TABLE alerta_eventos ADD COLUMN IF NOT EXISTS destinatarios INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alerta_eventos ADD COLUMN IF NOT EXISTS notificados   INTEGER NOT NULL DEFAULT 0;
