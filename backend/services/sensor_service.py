import psycopg2.extras
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from repositories import sensor_repo
from datetime import datetime, timedelta
from db import get_connection

def _calcular_intervalo(desde: datetime, hasta: datetime):
    duracion = hasta - desde
    if duracion <= timedelta(hours=4):
        return "1 minute"
    elif duracion <= timedelta(hours=12):
        return "3 minutes"
    elif duracion <= timedelta(hours=24):
        return "5 minutes"
    elif duracion <= timedelta(hours=48):
        return "10 minutes"
    elif duracion <= timedelta(days=5):
        return "30 minutes"
    elif duracion <= timedelta(days=12):
        return "1 hour"
    elif duracion <= timedelta(weeks=4):
        return "3 hours"
    elif duracion <= timedelta(weeks=10):
        return "6 hours"
    elif duracion <= timedelta(weeks=22):
        return "12 hours"
    elif duracion <= timedelta(weeks=40):
        return "1 day"
    elif duracion <= timedelta(weeks=72):
        return "2 days"
    else:
        return "1 week"

def crear_sensor(sensor) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor_repo.crear(cur, sensor.dispositivo_id, sensor.tipo_sensor_id, sensor.nombre)

def obtener_sensor(sensor_id) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = sensor_repo.buscar_por_id(cur, sensor_id)
            if sensor is None:
                raise HTTPException(404, "sensor no existe")
            return sensor

def obtener_tipo_sensor(sensor_id) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            tipo = sensor_repo.buscar_tipo(cur, sensor_id)
            if tipo is None:
                raise HTTPException(404, "tipo de sensor no encontrado")
            return tipo

def obtener_grafico(sensor_id, desde, hasta) -> dict:
    hasta = hasta or datetime.now(timezone.utc)
    desde = desde or hasta - timedelta(hours=24)
    intervalo = _calcular_intervalo(desde, hasta)

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT 1 FROM sensores WHERE id = %s", (sensor_id,))
            if cur.fetchone() is None:
                raise HTTPException(404, "Sensor no encontrado")
            
            puntos = sensor_repo.buscar_puntos(cur, sensor_id, desde, hasta, intervalo)
            resumen = sensor_repo.buscar_resumen(cur, sensor_id, desde, hasta)

    return {"puntos": puntos, "resumen": resumen}