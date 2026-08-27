import psycopg2.extras
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from repositories import sensor_repo, tipo_sensor_repo
from datetime import datetime, timedelta
from services import dispositivo_service
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
            return sensor_repo.crear(cur, sensor.dispositivo_id, sensor.tipo_sensor_id)

def obtener_sensor(sensor_id, usuario_id, rol) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = sensor_repo.buscar_por_id(cur, sensor_id)
            if sensor is None:
                raise HTTPException(404, "El sensor no existe")
            
            if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
                raise HTTPException(403, "No tienes acceso a este recurso")
            
            sensor["tipo_sensor"] = tipo_sensor_repo.obtener_tipo_sensor_por_sensor_id(cur, sensor_id)
            return sensor

def obtener_grafico(sensor_id, desde, hasta, usuario_id, rol) -> dict:
    hasta = hasta or datetime.now(timezone.utc)
    desde = desde or hasta - timedelta(hours=24)
    intervalo = _calcular_intervalo(desde, hasta)

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = sensor_repo.buscar_por_id(cur, sensor_id)
            if sensor is None:
                raise HTTPException(404, "El sensor no existe")

            if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
                raise HTTPException(403, "No tienes acceso a este recurso")
            
            puntos = sensor_repo.buscar_puntos(cur, sensor_id, desde, hasta, intervalo)
            resumen = sensor_repo.buscar_resumen(cur, sensor_id, desde, hasta)

    return {"puntos": puntos, "resumen": resumen}