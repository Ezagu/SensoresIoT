from db import get_cursor
from repositories import tipo_sensor_repo

def crear_tipo_sensor(tipo_sensor) -> dict:
    nombre = tipo_sensor.nombre.capitalize()
    with get_cursor() as cur:
        return tipo_sensor_repo.crear(cur, nombre, tipo_sensor.unidad)

def listar_tipos_sensor() -> list[dict]:
    with get_cursor() as cur:
        return tipo_sensor_repo.listar(cur)
