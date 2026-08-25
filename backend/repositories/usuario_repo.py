import psycopg2.extras
from datetime import datetime, timezone

def buscar_por_email(cur, email: str) -> dict | None:
    cur.execute(
        "SELECT id, is_verified FROM usuarios WHERE email = %s",
        (email,)
    )
    return cur.fetchone()

def buscar_por_id(cur, user_id: str) -> dict | None:
    cur.execute(
        "SELECT id, nombre, email, rol, created_at, is_verified FROM usuarios WHERE id = %s",
        (user_id,)
    )
    return cur.fetchone()

def crear(cur, nombre: str, email: str, password_hash: str) -> dict:
    cur.execute(
        """
        INSERT INTO usuarios (nombre, password, email, created_at)
        VALUES (%s, %s, %s, %s)
        RETURNING id, nombre, email, rol, created_at, is_verified
        """,
        (nombre, password_hash, email, datetime.now(timezone.utc))
    )
    return cur.fetchone()

def marcar_verificado(cur, user_id: str) -> None:
    cur.execute("UPDATE usuarios SET is_verified = true WHERE id = %s", (user_id,))