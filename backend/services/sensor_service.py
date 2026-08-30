import psycopg2.extras
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from repositories import sensor_repo, tipo_sensor_repo, medicion_repo
from services import dispositivo_service, plan_service
from db import get_connection

LIMITE_DEFAULT_HISTORIAL = 50
LIMITE_MAXIMO_HISTORIAL = 200

def _a_utc(momento):
    # Los query params pueden llegar sin zona horaria; se asumen UTC para poder
    # compararlos contra now(timezone.utc) sin que reviente la resta.
    if momento is not None and momento.tzinfo is None:
        return momento.replace(tzinfo=timezone.utc)
    return momento

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
    hasta = _a_utc(hasta) or datetime.now(timezone.utc)
    desde = _a_utc(desde) or hasta - timedelta(hours=24)

    if desde >= hasta:
        raise HTTPException(400, "El rango de fechas seleccionado es incorrecto")

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = _validar_que_exista_sensor(cur, sensor_id)

            if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
                raise HTTPException(403, "No tienes acceso a este recurso")

            ventana = plan_service.ventana_de_consulta(cur, sensor["dispositivo_id"], rol)
            recortado = ventana["piso"] is not None and desde < ventana["piso"]
            if recortado:
                desde = ventana["piso"]

            # Subir `desde` sólo puede bajar la antigüedad del rango, así que la fuente
            # que elige medicion_repo queda igual o más fina: no hay que tocar FUENTES.
            #
            # El rango pedido puede caer entero fuera de la ventana del plan. Eso no es
            # un error del cliente: se devuelve vacío con `recortado` para que el
            # frontend distinga "no hay datos" de "tu plan no llega hasta ahí".
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
    hasta = _a_utc(hasta)
    cursor = _a_utc(cursor)

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sensor = _validar_que_exista_sensor(cur, sensor_id)

            if not dispositivo_service.tiene_acceso_a_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol):
                raise HTTPException(403, "No tienes acceso a este recurso")

            # El piso corta la paginación en la frontera del plan: sin él un free
            # seguiría trayendo páginas hacia atrás indefinidamente.
            ventana = plan_service.ventana_de_consulta(cur, sensor["dispositivo_id"], rol)
            filas = medicion_repo.buscar_historial(cur, sensor_id, hasta, cursor, limite, ventana["piso"])

    siguiente_cursor = filas[-1]["time"] if len(filas) == limite else None
    return {
        "mediciones": filas,
        "siguiente_cursor": siguiente_cursor,
        "retencion_dias": ventana["retencion_dias"],
    }
