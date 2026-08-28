import psycopg2.extras
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from repositories import sensor_repo, tipo_sensor_repo, medicion_repo
from datetime import datetime, timedelta
from services import dispositivo_service
from db import get_connection

LIMITE_DEFAULT_HISTORIAL = 50
LIMITE_MAXIMO_HISTORIAL = 200

def _validar_que_exista_sensor(cur, sensor_id) -> dict:
    sensor = sensor_repo.buscar_por_id(cur, sensor_id)
    if sensor is None:
        raise HTTPException(404, "El sensor no existe")
    return sensor

def crear_sensor(sensor) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return sensor_repo.crear(cur, sensor.dispositivo_id, sensor.tipo_sensor_id)

def obtener_sensor(sensor_id, usuario_id, rol) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = _validar_que_exista_sensor(cur, sensor_id)
            
            if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
                raise HTTPException(403, "No tienes acceso a este recurso")
            
            sensor["tipo_sensor"] = tipo_sensor_repo.obtener_tipo_sensor_por_sensor_id(cur, sensor_id)
            return sensor

def obtener_grafico(sensor_id, desde, hasta, usuario_id, rol) -> dict:
    hasta = hasta or datetime.now(timezone.utc)
    desde = desde or hasta - timedelta(hours=24)

    if desde >= hasta:
        raise HTTPException(400, "El rango de fechas seleccionado es incorrecto")

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = _validar_que_exista_sensor(cur, sensor_id)

            if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
                raise HTTPException(403, "No tienes acceso a este recurso")
            
            puntos = medicion_repo.buscar_puntos(cur, sensor_id, desde, hasta)
            resumen = medicion_repo.buscar_resumen(cur, sensor_id, desde, hasta)

    return {"puntos": puntos, "resumen": resumen}

def obtener_historial(sensor_id, hasta, cursor, limite, usuario_id, rol) -> dict:
    limite = min(limite or LIMITE_DEFAULT_HISTORIAL, LIMITE_MAXIMO_HISTORIAL)

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = _validar_que_exista_sensor(cur, sensor_id)

            if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
                raise HTTPException(403, "No tienes acceso a este recurso")

            filas = medicion_repo.buscar_historial(cur, sensor_id, hasta, cursor, limite)

    siguiente_cursor = filas[-1]["time"] if len(filas) == limite else None
    return {"mediciones": filas, "siguiente_cursor": siguiente_cursor}