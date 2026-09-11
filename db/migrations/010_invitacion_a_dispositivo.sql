CREATE TABLE invitacion_dispositivo (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_id     UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    email              TEXT,
    rol                TEXT NOT NULL CHECK (rol IN ('viewer', 'editor')),
    token              TEXT NOT NULL,
    expires_at         TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_un_solo_link_por_rol
ON invitacion_dispositivo (dispositivo_id, rol)
WHERE email IS NULL;
