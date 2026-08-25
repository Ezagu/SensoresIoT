import psycopg2.errors
from fastapi import HTTPException

def crear(cur, usuario_id, nombre: str, ubicacion: str, descripcion: str) -> dict:
    try:
        cur.execute(
            f"""
            INSERT INTO dispositivos (usuario_id, nombre, ubicacion, descripcion)
            VALUES (%s, %s, %s, %s)
            RETURNING *
            """,
            (usuario_id, nombre, ubicacion, descripcion)
        )
        return cur.fetchone()
    except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(404, "usuario_id no existe")

def buscar_por_id(cur, dispositivo_id) -> dict | None:
    cur.execute("SELECT * FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()