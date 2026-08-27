def crear(cur, usuario_id, token_hash, expires_at) -> None:
    cur.execute(
        """
        INSERT INTO refresh_token (usuario_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (usuario_id, token_hash, expires_at)
    )

def buscar_por_token_hash(cur, token_hash) -> dict | None:
    cur.execute("SELECT * FROM refresh_token WHERE token_hash = %s", (token_hash,))
    return cur.fetchone()

def revocar(cur, refresh_token_id) -> None:
    cur.execute(
        """
        UPDATE refresh_token
        SET revocado = true, revocado_at = now()
        WHERE id = %s
        """,
        (refresh_token_id,)
    )