import psycopg2.errors
from fastapi import HTTPException
from core.security import generar_secret_dispositivo

COLUMNAS_PUBLICAS = "id, nombre, ubicacion, descripcion, activo, last_seen_at, first_connected_at"

def crear(cur, nombre: str, ubicacion: str, descripcion: str) -> dict:
    secret, secret_hash = generar_secret_dispositivo()
    try:
        cur.execute(
            f"""
            INSERT INTO dispositivos (nombre, ubicacion, descripcion, secret_hash)
            VALUES (%s, %s, %s, %s)
            RETURNING {COLUMNAS_PUBLICAS}
            """,
            (nombre, ubicacion, descripcion, secret_hash)
        )
        dispositivo = cur.fetchone()
        return {"dispositivo": dispositivo, "secret": secret}
    except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(404, "El usuario no existe")

def actualizar_secret(cur, dispositivo_id) -> str:
    secret, secret_hash = generar_secret_dispositivo()
    cur.execute(
        """
        UPDATE dispositivos
        SET secret_hash = %s
        WHERE id = %s
        RETURNING id
        """,
        (secret_hash, dispositivo_id)
    )
    disp = cur.fetchone()
    if not disp:
        raise HTTPException(404, "Dispositivo no encontrado")
    return secret

def buscar_por_id(cur, dispositivo_id) -> dict | None:
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()

def buscar_por_usuario(cur, usuario_id) -> list[dict]:
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM dispositivos WHERE usuario_id = %s", (usuario_id,))
    return cur.fetchall()

def actualizar_conexion(cur, dispositivo_id, timestamp) -> bool:
    cur.execute(
        """
        UPDATE dispositivos
        SET first_connected_at = COALESCE(first_connected_at, %s),
            last_seen_at = %s
        WHERE id = %s
        RETURNING id
        """,
        (timestamp, timestamp, dispositivo_id)
    )
    return cur.fetchone() is not None