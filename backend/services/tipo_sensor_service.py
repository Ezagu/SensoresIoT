import psycopg2.extras
from db import get_connection
from repositories import tipo_sensor_repo

def crear_tipo_sensor(tipo_sensor) -> dict:
    nombre = tipo_sensor.nombre.capitalize()
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return tipo_sensor_repo.crear(
                cur, nombre, tipo_sensor.unidad, tipo_sensor.valor_min, tipo_sensor.valor_max
            )

def listar_tipos_sensor() -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return tipo_sensor_repo.listar(cur)