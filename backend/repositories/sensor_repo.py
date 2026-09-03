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

def buscar_con_tipo_por_dispositivo(cur, dispositivo_id) -> list[dict]:
    # Sin filtrar por `activo`: un sensor desactivado sigue teniendo mediciones
    # históricas válidas para exportar. Orden estable por nombre+created_at.
    cur.execute(
        """
        SELECT s.id, ts.nombre, ts.unidad
        FROM sensores s
        JOIN tipos_sensor ts ON s.tipo_sensor_id = ts.id
        WHERE s.dispositivo_id = %s
        ORDER BY ts.nombre, s.created_at
        """,
        (dispositivo_id,)
    )
    return cur.fetchall()

def buscar_con_tipo_por_dispositivos(cur, dispositivo_ids: list) -> list[dict]:
    # Versión por lote de buscar_con_tipo_por_dispositivo, para el panel. A
    # diferencia de esa (usada por el export, que quiere también los inactivos),
    # acá sí se filtra por activo: son los mismos que hoy ve el panel.
    if not dispositivo_ids:
        return []
    cur.execute(
        """
        SELECT s.id, s.dispositivo_id, s.tipo_sensor_id, ts.nombre AS tipo_nombre, ts.unidad
        FROM sensores s
        JOIN tipos_sensor ts ON ts.id = s.tipo_sensor_id
        WHERE s.dispositivo_id = ANY(%s) AND s.activo
        ORDER BY s.dispositivo_id, ts.nombre, s.created_at
        """,
        (dispositivo_ids,)
    )
    return cur.fetchall()

def ids_por_dispositivo(cur, dispositivo_id) -> set:
    cur.execute("SELECT id FROM sensores WHERE dispositivo_id = %s", (dispositivo_id,))
    return {row[0] for row in cur.fetchall()}