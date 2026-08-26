import psycopg2.errors
from fastapi import HTTPException

def crear(cur, nombre, unidad, valor_min, valor_max):
    try:
        cur.execute(
        """
        INSERT INTO tipos_sensor (nombre, unidad, valor_min, valor_max)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (nombre, unidad, valor_min, valor_max)
        )
        return cur.fetchone()
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Ya existe un tipo de sensor con ese nombre")

def listar(cur):
    cur.execute("SELECT * FROM tipos_sensor")
    return cur.fetchall()