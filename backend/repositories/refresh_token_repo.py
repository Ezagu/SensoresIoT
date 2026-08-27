def crear(cur, usuario_id, token_hash, expires_at):
    cur.execute(
        """
        INSERT INTO refresh_token (usuario_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (usuario_id, token_hash, expires_at)
    )