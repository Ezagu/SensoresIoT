import psycopg2.errors
from fastapi import HTTPException

def crear(cur, nombre, unidad, valor_min, valor_max) -> dict:
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

def listar(cur) -> list[dict]:
    cur.execute("SELECT * FROM tipos_sensor")
    return cur.fetchall()

def obtener_tipo_sensor_por_sensor_id(cur, sensor_id) -> dict:
    cur.execute(
        """
        SELECT ts.nombre, ts.unidad FROM tipos_sensor ts
        JOIN sensores s ON s.tipo_sensor_id = ts.id 
        WHERE s.id = %s
        """,
        (sensor_id,)
        )
    return cur.fetchone()