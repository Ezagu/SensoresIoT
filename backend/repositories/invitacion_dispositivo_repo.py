def crear(cur, dispositivo_id, rol, token_hash, expires_at, email) -> dict:
    valores = [dispositivo_id, rol, token_hash, expires_at]

    COLUMNAS = ("dispositivo_id", "rol", "token_hash", "expires_at")

    if email is not None:
        COLUMNAS += ("email",)
        valores.append(email)

    cur.execute(
        f"""
        INSERT INTO invitacion_dispositivo ({', '.join(COLUMNAS)})
        VALUES ({', '.join(['%s'] * len(COLUMNAS))})
        RETURNING *
        """,
        tuple(valores)
    )
    return cur.fetchone()

def buscar(cur, dispositivo_id, token_hash) -> dict | None:
    cur.execute(
        "SELECT * FROM invitacion_dispositivo WHERE dispositivo_id = %s AND token_hash = %s",
        (dispositivo_id, token_hash)
    )
    return cur.fetchone()

def eliminar(cur, dispositivo_id, token_hash) -> bool:
    cur.execute(
        "DELETE FROM invitacion_dispositivo WHERE dispositivo_id = %s AND token_hash = %s",
        (dispositivo_id, token_hash)
    )
    return cur.rowcount > 0