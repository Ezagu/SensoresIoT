CREATE TABLE invitacion_dispositivo (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_id     UUID NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
    email              TEXT,
    rol                TEXT NOT NULL CHECK (rol IN ('viewer', 'editor')),
    token_hash         TEXT NOT NULL,
    expires_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);