from datetime import datetime, timezone, timedelta

def eliminar_por_usuario(cur, user_id: str) -> None:
    cur.execute("DELETE FROM verificaciones_email WHERE usuario_id = %s", (user_id,))

def crear(cur, user_id: str, token_hash: str) -> None:
    cur.execute(
        """
        INSERT INTO verificaciones_email (usuario_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (user_id, token_hash, datetime.now(timezone.utc) + timedelta(hours=24))
    )

def buscar_por_token_hash(cur, token_hash: str) -> dict | None:
    cur.execute(
        "SELECT usuario_id, expires_at FROM verificaciones_email WHERE token_hash = %s",
        (token_hash,)
    )
    return cur.fetchone()

def eliminar_por_token_hash(cur, token_hash: str) -> None:
    cur.execute("DELETE FROM verificaciones_email WHERE token_hash = %s", (token_hash,))