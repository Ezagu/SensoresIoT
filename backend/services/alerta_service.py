from collections import defaultdict
from datetime import timedelta
from fastapi import HTTPException
from repositories import acceso_repo, alerta_repo, sensor_repo
from services import dispositivo_service, plan_service, sensor_service
from core.tiempo import a_utc
from core.email import enviar_email_alerta, enviar_email_sin_reportar
from db import get_cursor

LIMITE_DEFAULT_EVENTOS = 50
LIMITE_MAXIMO_EVENTOS = 200

# Ventana de frescura: una transición causada por una lectura más vieja que
# esto viene de un flush del buffer del firmware, no de algo que "está pasando
# ahora". Se notifica igual, pero el mail lo aclara.
FRESCURA = timedelta(minutes=5)

def _empuja(estado, condicion, umbral, histeresis, valor) -> bool:
    """
    ¿Esta lectura empuja hacia el otro estado? La ida se mide contra el umbral
    y la vuelta contra el umbral corrido por la histéresis, para que un valor
    oscilando sobre el borde no haga flapear la regla.
    """
    if condicion == "mayor":
        return valor > umbral if estado == "normal" else valor < umbral - histeresis
    return valor < umbral if estado == "normal" else valor > umbral + histeresis

def validar_que_exista_alerta(cur, alerta_id) -> dict:
    alerta = alerta_repo.buscar_por_id(cur, alerta_id)
    if alerta is None:
        raise HTTPException(404, "La alerta no existe")
    return alerta

def validar_alerta_con_rol(cur, alerta_id, usuario_id, rol, edicion = False) -> tuple[dict, str]:
    alerta = validar_que_exista_alerta(cur, alerta_id)
    sensor = sensor_repo.buscar_por_id(cur, alerta["sensor_id"])
    if edicion:
        dispositivo_service.validar_edicion_en_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol)
    else:
        dispositivo_service.validar_acceso_al_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol)
    return alerta

# --------------------------------------------------------------------------
# Evaluación inline (llamada desde medicion_service.crear_medicion)
# --------------------------------------------------------------------------

def evaluar_batch(cur, filas: list[tuple], ahora) -> list[dict]:
    """
    `filas` es exactamente lo que medicion_service insertó: (timestamp, sensor_id,
    value), ya ordenado por tiempo. Devuelve como máximo una notificación por
    regla que cambió de estado en este batch (la última transición), con sus
    destinatarios ya resueltos; el resto queda registrado en alerta_eventos
    pero sin mandar mail.

    La transición no ocurre en el primer cruce sino tras `muestras_confirmacion`
    lecturas seguidas: una lectura corrupta suelta no puede disparar un mail.
    """
    por_sensor = defaultdict(list)
    for timestamp, sensor_id, value in filas:
        por_sensor[sensor_id].append((timestamp, value))

    reglas = alerta_repo.buscar_activas_por_sensores(cur, list(por_sensor.keys()))
    if not reglas:
        return []

    notificaciones = []
    destinatarios_por_dispositivo = {}

    for regla in reglas:
        lecturas = por_sensor.get(regla["sensor_id"], [])
        if not lecturas:
            continue

        estado = regla["estado"]
        estado_desde = regla["estado_desde"]
        ultima_evaluacion = regla["ultima_evaluacion_at"]
        ultimo_valor = regla["ultimo_valor"]
        cruces = regla["cruces_consecutivos"]
        transiciones = []

        for timestamp, value in lecturas:
            # Ya evaluada (reintento de un chunk, o dato que llegó fuera de
            # orden detrás de uno más nuevo): no se reevalúa ni se retrocede.
            if ultima_evaluacion is not None and timestamp <= ultima_evaluacion:
                continue

            ultima_evaluacion = timestamp
            ultimo_valor = value

            if not _empuja(estado, regla["condicion"], regla["umbral"], regla["histeresis"], value):
                cruces = 0
                continue

            cruces += 1
            if cruces < regla["muestras_confirmacion"]:
                continue

            estado = "disparada" if estado == "normal" else "normal"
            cruces = 0
            estado_desde = timestamp
            transiciones.append({
                "tipo": estado if estado == "disparada" else "normalizada",
                "valor": value,
                "medicion_at": timestamp,
                "tardio": (ahora - timestamp) > FRESCURA,
            })

        if ultima_evaluacion == regla["ultima_evaluacion_at"]:
            continue  # todo lo que llegó ya estaba evaluado

        notificar_ultima = bool(transiciones)
        alerta_repo.actualizar_estado(
            cur, regla["id"], estado, estado_desde, ultimo_valor, ultima_evaluacion,
            cruces, notificada=notificar_ultima,
        )

        if not transiciones:
            continue

        filas_eventos = [
            (regla["dispositivo_id"], regla["id"], t["tipo"], t["valor"], t["medicion_at"],
             ahora, t["tardio"], regla["nombre"], regla["condicion"], regla["umbral"],
             regla["tipo_sensor_nombre"], regla["tipo_sensor_unidad"])
            for t in transiciones
        ]
        insertados = alerta_repo.insertar_eventos(cur, filas_eventos)
        ultimo_evento_id = insertados[-1]["id"]

        # Memoizado: varias reglas del mismo equipo comparten destinatarios y la
        # query no depende de la regla.
        dispositivo_id = regla["dispositivo_id"]
        if dispositivo_id not in destinatarios_por_dispositivo:
            destinatarios_por_dispositivo[dispositivo_id] = acceso_repo.destinatarios(cur, dispositivo_id)
        destinatarios = destinatarios_por_dispositivo[dispositivo_id]
        alerta_repo.actualizar_destinatarios(cur, ultimo_evento_id, len(destinatarios))

        ultima = transiciones[-1]
        notificaciones.append({
            "evento_id": ultimo_evento_id,
            "destinatarios": destinatarios,  # [{id, email, nombre}, ...]
            "tipo": ultima["tipo"],
            "valor": ultima["valor"],
            "medicion_at": ultima["medicion_at"],
            "tardio": ultima["tardio"],
            "cantidad_episodios": len(transiciones),
            "alerta_nombre": regla["nombre"],
            "condicion": regla["condicion"],
            "umbral": regla["umbral"],
            "dispositivo_nombre": regla["dispositivo_nombre"],
            "tipo_sensor_nombre": regla["tipo_sensor_nombre"],
            "tipo_sensor_unidad": regla["tipo_sensor_unidad"],
        })

    return notificaciones

TIPOS_DE_CONECTIVIDAD = ("sin_reportar", "reconectado")

def notificar_eventos(notificaciones: list[dict]) -> None:
    # Corre fuera de la transacción que escribió los eventos: en el camino de
    # /mediciones como BackgroundTask (Resend es HTTP bloqueante y el ESP32 no
    # puede esperarlo) y en el barrido de vigilancia_service después del commit.
    # Un destinatario que rebota no frena a los demás (try/except por
    # destinatario, igual que auth_service con el mail de verificación).
    #
    # Despacha la plantilla por `tipo` en vez de tener una copia de este bucle por
    # familia de aviso: es el único lugar que escribe `notificados`, y duplicarlo
    # es la forma canónica de que dos registros terminen contando distinto.
    for notificacion in notificaciones:
        enviar = (
            enviar_email_sin_reportar if notificacion["tipo"] in TIPOS_DE_CONECTIVIDAD
            else enviar_email_alerta
        )
        enviados = 0
        for destinatario in notificacion["destinatarios"]:
            try:
                enviar(destinatario["email"], notificacion)
            except Exception as e:
                print(f"Error enviando mail de alerta a {destinatario['email']}: {e}")
                continue
            enviados += 1

        with get_cursor() as cur:
            alerta_repo.actualizar_notificados(cur, notificacion["evento_id"], enviados)

# --------------------------------------------------------------------------
# CRUD
# --------------------------------------------------------------------------

def crear_alerta(alerta, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        sensor = sensor_service.validar_que_exista_sensor(cur, alerta.sensor_id)
        dispositivo_id = sensor["dispositivo_id"]

        dispositivo_service.validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        limites = plan_service.limites_de_dispositivo(cur, dispositivo_id)
        
        if not limites["puede_alertas"]:
            raise HTTPException(403, "El plan de este dispositivo no incluye alertas")
        if limites["max_alertas"] is not None and alerta_repo.contar_por_dispositivo(cur, dispositivo_id) >= limites["max_alertas"]:
            raise HTTPException(403, "Alcanzaste el límite de alertas de este dispositivo")

        return alerta_repo.crear(
            cur, alerta.sensor_id, usuario_id, alerta.nombre,
            alerta.condicion, alerta.umbral, alerta.histeresis,
            alerta.muestras_confirmacion,
        )

def listar_por_dispositivo(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        dispositivo_service.validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return alerta_repo.listar_por_dispositivo(cur, dispositivo_id)

def obtener_alerta(alerta_id, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        return validar_alerta_con_rol(cur, alerta_id, usuario_id, rol)

def actualizar_alerta(alerta_id, usuario_id, rol, cambios) -> dict:
    with get_cursor() as cur:
        validar_alerta_con_rol(cur, alerta_id, usuario_id, rol, edicion=True)
        return alerta_repo.actualizar(
            cur, alerta_id, cambios.nombre, cambios.umbral, cambios.histeresis,
            cambios.activa, cambios.muestras_confirmacion,
        )

def eliminar_alerta(alerta_id, usuario_id, rol) -> None:
    with get_cursor() as cur:
        validar_alerta_con_rol(cur, alerta_id, usuario_id, rol, edicion=True)
        alerta_repo.eliminar(cur, alerta_id)

def obtener_eventos(alerta_id, usuario_id, rol, hasta, cursor, limite) -> dict:
    limite = min(limite or LIMITE_DEFAULT_EVENTOS, LIMITE_MAXIMO_EVENTOS)
    hasta = a_utc(hasta)
    cursor = a_utc(cursor)

    with get_cursor() as cur:
        validar_alerta_con_rol(cur, alerta_id, usuario_id, rol)
        filas = alerta_repo.listar_eventos_por_alerta(cur, alerta_id, hasta, cursor, limite)

    siguiente_cursor = filas[-1]["medicion_at"] if len(filas) == limite else None
    return {"eventos": filas, "siguiente_cursor": siguiente_cursor}

def eventos_por_dispositivo(dispositivo_id, usuario_id, rol, hasta, cursor, limite) -> dict:
    limite = min(limite or LIMITE_DEFAULT_EVENTOS, LIMITE_MAXIMO_EVENTOS)
    hasta = a_utc(hasta)
    cursor = a_utc(cursor)

    with get_cursor() as cur:
        dispositivo_service.validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        filas = alerta_repo.listar_eventos_por_dispositivo(cur, dispositivo_id, hasta, cursor, limite)

    siguiente_cursor = filas[-1]["medicion_at"] if len(filas) == limite else None
    return {"eventos": filas, "siguiente_cursor": siguiente_cursor}

def eventos_globales(usuario_id, hasta, cursor, limite) -> dict:
    # Log del usuario: eventos de alertas de todos los dispositivos a los que
    # tiene acceso, sin importar el rol.
    limite = min(limite or LIMITE_DEFAULT_EVENTOS, LIMITE_MAXIMO_EVENTOS)
    hasta = a_utc(hasta)
    cursor = a_utc(cursor)

    with get_cursor() as cur:
        filas = alerta_repo.listar_eventos_por_usuario(cur, usuario_id, hasta, cursor, limite)

    siguiente_cursor = filas[-1]["medicion_at"] if len(filas) == limite else None
    return {"eventos": filas, "siguiente_cursor": siguiente_cursor}
