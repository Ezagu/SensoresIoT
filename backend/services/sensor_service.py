from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from repositories import sensor_repo, tipo_sensor_repo, medicion_repo
from services import dispositivo_service, plan_service
from core.tiempo import a_utc
from db import get_cursor

LIMITE_DEFAULT_HISTORIAL = 50
LIMITE_MAXIMO_HISTORIAL = 200

def validar_que_exista_sensor(cur, sensor_id) -> dict:
    sensor = sensor_repo.buscar_por_id(cur, sensor_id)
    if sensor is None:
        raise HTTPException(404, "El sensor no existe")
    return sensor

def _obtener_sensor_con_acceso(cur, sensor_id, usuario_id, rol) -> dict:
    sensor = validar_que_exista_sensor(cur, sensor_id)
    if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
        raise HTTPException(403, "No tienes acceso a este recurso")
    return sensor

def crear_sensor(sensor) -> dict:
    with get_cursor() as cur:
        return sensor_repo.crear(cur, sensor.dispositivo_id, sensor.tipo_sensor_id)

def obtener_sensor(sensor_id, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        sensor = _obtener_sensor_con_acceso(cur, sensor_id, usuario_id, rol)
        sensor["tipo_sensor"] = tipo_sensor_repo.obtener_tipo_sensor_por_sensor_id(cur, sensor_id)
        return sensor

def obtener_grafico(sensor_id, desde, hasta, usuario_id, rol) -> dict:
    hasta = a_utc(hasta) or datetime.now(timezone.utc)
    desde = a_utc(desde) or hasta - timedelta(hours=24)

    if desde >= hasta:
        raise HTTPException(400, "El rango de fechas seleccionado es incorrecto")

    with get_cursor() as cur:
        sensor = _obtener_sensor_con_acceso(cur, sensor_id, usuario_id, rol)

        ventana = plan_service.ventana_de_consulta(cur, sensor["dispositivo_id"], rol)
        recortado = ventana["piso"] is not None and desde < ventana["piso"]
        if recortado:
            desde = ventana["piso"]

        # El rango pedido puede caer entero fuera de la ventana del plan: no es un
        # error del cliente, se devuelve vacío con `recortado` en true.
        if desde >= hasta:
            puntos = []
            resumen = {"promedio": None, "minimo": None, "maximo": None}
        else:
            puntos = medicion_repo.buscar_puntos(cur, sensor_id, desde, hasta)
            resumen = medicion_repo.buscar_resumen(cur, sensor_id, desde, hasta)

    return {
        "puntos": puntos,
        "resumen": resumen,
        "desde_efectivo": desde,
        "recortado": recortado,
        "retencion_dias": ventana["retencion_dias"],
    }

def obtener_historial(sensor_id, hasta, cursor, limite, usuario_id, rol) -> dict:
    limite = min(limite or LIMITE_DEFAULT_HISTORIAL, LIMITE_MAXIMO_HISTORIAL)
    hasta = a_utc(hasta)
    cursor = a_utc(cursor)

    with get_cursor() as cur:
        sensor = _obtener_sensor_con_acceso(cur, sensor_id, usuario_id, rol)

        ventana = plan_service.ventana_de_consulta(cur, sensor["dispositivo_id"], rol)
        filas = medicion_repo.buscar_historial(cur, sensor_id, hasta, cursor, limite, ventana["piso"])

    siguiente_cursor = filas[-1]["time"] if len(filas) == limite else None
    return {
        "mediciones": filas,
        "siguiente_cursor": siguiente_cursor,
        "retencion_dias": ventana["retencion_dias"],
    }
