from datetime import datetime, timezone

COLUMNAS_PUBLICAS = "id, nombre, email, rol, created_at, is_verified"

def buscar_por_id(cur, usuario_id: str) -> dict | None:
    cur.execute(
        f"SELECT {COLUMNAS_PUBLICAS} FROM usuarios WHERE id = %s",
        (usuario_id,)
    )
    return cur.fetchone()

def buscar_por_email(cur, email: str) -> dict | None:
    cur.execute(
        "SELECT * FROM usuarios WHERE email = %s",
        (email,)
    )
    return cur.fetchone()

def buscar_email(cur, usuario_id: str) -> str | None:
    cur.execute(
        "SELECT email FROM usuarios WHERE id = %s",
        (usuario_id,)
    )
    result = cur.fetchone()
    return result["email"] if result else None

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

def marcar_verificado(cur, usuario_id: str) -> None:
    cur.execute("UPDATE usuarios SET is_verified = true WHERE id = %s", (usuario_id,))

def listar(cur) -> list[dict]:
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM usuarios")
    return cur.fetchall()

def actualizar_intentos_fallidos(cur, usuario_id, nuevos_intentos, bloqueado_hasta) -> None:
    cur.execute(
        """
        UPDATE usuarios
        SET intentos_fallidos = %s,
            bloqueado_hasta = %s
        WHERE id = %s
        """,
        (nuevos_intentos, bloqueado_hasta, usuario_id),
    )