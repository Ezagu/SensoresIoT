def crear(cur, dispositivo_id, rol, token, expires_at, email) -> dict | None:
    email = email.lower() if email is not None else None
    # None = ya hay un link global vigente para ese rol. El conflicto se resuelve
    # acá y no con un UniqueViolation porque un link vencido no tiene que bloquear
    # al siguiente: se pisa. La invitación por email nunca entra al ON CONFLICT,
    # el índice es parcial sobre email IS NULL.
    cur.execute(
        """
        INSERT INTO invitacion_dispositivo (dispositivo_id, rol, token, expires_at, email)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (dispositivo_id, rol) WHERE email IS NULL
        DO UPDATE SET token = EXCLUDED.token,
                      expires_at = EXCLUDED.expires_at,
                      created_at = now()
        WHERE invitacion_dispositivo.expires_at <= now()
        RETURNING *
        """,
        (dispositivo_id, rol, token, expires_at, email)
    )
    return cur.fetchone()

def buscar(cur, dispositivo_id, token) -> dict | None:
    cur.execute(
        "SELECT * FROM invitacion_dispositivo WHERE dispositivo_id = %s AND token = %s",
        (dispositivo_id, token)
    )
    return cur.fetchone()

def buscar_por_id(cur, dispositivo_id, invitacion_id) -> dict | None:
    cur.execute(
        "SELECT * FROM invitacion_dispositivo WHERE dispositivo_id = %s AND id = %s",
        (dispositivo_id, invitacion_id)
    )
    return cur.fetchone()

def regenerar(cur, dispositivo_id, invitacion_id, token, expires_at) -> dict | None:
    # UPDATE y no DELETE + crear: conserva el id (lo necesita el cooldown para
    # ser atribuible) y created_at.
    cur.execute(
        """
        UPDATE invitacion_dispositivo
        SET token = %s, expires_at = %s, regenerado_at = now()
        WHERE dispositivo_id = %s AND id = %s
        RETURNING *
        """,
        (token, expires_at, dispositivo_id, invitacion_id)
    )
    return cur.fetchone()

def eliminar(cur, dispositivo_id, invitacion_id) -> bool:
    cur.execute(
        "DELETE FROM invitacion_dispositivo WHERE dispositivo_id = %s AND id = %s",
        (dispositivo_id, invitacion_id)
    )
    return cur.rowcount > 0

def listar_por_dispositivo(cur, dispositivo_id) -> list[dict]:
    cur.execute(
        "SELECT * FROM invitacion_dispositivo WHERE dispositivo_id = %s",
        (dispositivo_id,)
    )
    return cur.fetchall()
