import psycopg2.errors
from fastapi import HTTPException

def crear(cur, dispositivo_id, tipo_sensor_id) -> dict:
    try:
        cur.execute(
            f"""
            INSERT INTO sensores (dispositivo_id, tipo_sensor_id)
            VALUES (%s, %s)
            RETURNING *
            """,
            (dispositivo_id, tipo_sensor_id)
        )
        return cur.fetchone()
    except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(404, "id de dispositivo o id del tipo de sensor no existe")

def buscar_por_id(cur, sensor_id) -> dict | None:
    cur.execute(f"SELECT * FROM sensores WHERE id = %s", (sensor_id,))
    return cur.fetchone()

def buscar_tipo(cur, sensor_id) -> dict | None:
    cur.execute(
        """
        SELECT ts.nombre, ts.unidad
        FROM sensores s
        JOIN tipos_sensor ts ON s.tipo_sensor_id = ts.id
        WHERE s.id = %s
        """,
        (sensor_id,)
    )
    return cur.fetchone()

def buscar_por_dispositivo_id(cur, dispositivo_id) -> list[dict]:
    cur.execute("SELECT * FROM sensores WHERE dispositivo_id = %s", (dispositivo_id,))
    return cur.fetchall()

def ids_por_dispositivo(cur, dispositivo_id) -> set:
    cur.execute("SELECT id FROM sensores WHERE dispositivo_id = %s", (dispositivo_id,))
    return {row[0] for row in cur.fetchall()}

def buscar_puntos(cur, sensor_id, desde, hasta, intervalo) -> list[dict]:
    cur.execute(
        """
        SELECT time_bucket(%s, time) AS bucket,
            AVG(value) AS promedio, MIN(value) AS minimo, MAX(value) AS maximo
        FROM mediciones
        WHERE sensor_id = %s AND time >= %s AND time <= %s
        GROUP BY bucket ORDER BY bucket ASC
        """,
        (intervalo, sensor_id, desde, hasta)
    )
    return cur.fetchall()

def buscar_resumen(cur, sensor_id, desde, hasta) -> dict:
    cur.execute(
        """
        SELECT AVG(value) AS promedio, MIN(value) AS minimo, MAX(value) AS maximo
        FROM mediciones WHERE sensor_id = %s AND time >= %s AND time <= %s
        """,
        (sensor_id, desde, hasta)
    )
    return cur.fetchone()