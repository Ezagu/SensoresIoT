from collections import defaultdict
from datetime import timedelta
from fastapi import HTTPException
from repositories import alerta_repo, sensor_repo, dispositivo_repo
from services import dispositivo_service, plan_service, sensor_service
from core.tiempo import a_utc
from core.email import enviar_email_alerta
from db import get_cursor

LIMITE_DEFAULT_EVENTOS = 50
LIMITE_MAXIMO_EVENTOS = 200

# Ventana de frescura: una transición causada por una lectura más vieja que
# esto viene de un flush del buffer del firmware, no de algo que "está pasando
# ahora". Se notifica igual, pero el mail lo aclara.
FRESCURA = timedelta(minutes=5)

def _transicion(estado, condicion, umbral, histeresis, valor) -> str:
    if condicion == "mayor":
        if estado == "normal" and valor > umbral:
            return "disparada"
        if estado == "disparada" and valor < umbral - histeresis:
            return "normal"
    else:
        if estado == "normal" and valor < umbral:
            return "disparada"
        if estado == "disparada" and valor > umbral + histeresis:
            return "normal"
    return estado

def _validar_que_exista_dispositivo(cur, dispositivo_id) -> dict:
    dispositivo = dispositivo_repo.buscar_por_id_publico(cur, dispositivo_id)
    if dispositivo is None:
        raise HTTPException(404, "El dispositivo no existe")
    return dispositivo

def _validar_que_exista_alerta(cur, alerta_id) -> dict:
    alerta = alerta_repo.buscar_por_id(cur, alerta_id)
    if alerta is None:
        raise HTTPException(404, "La alerta no existe")
    return alerta

def _obtener_alerta_con_rol(cur, alerta_id, usuario_id, rol, roles_permitidos=None) -> tuple[dict, str]:
    # Una alerta es del dispositivo, no de quien la creó: el permiso sale del
    # rol en usuario_dispositivo del dispositivo dueño del sensor de la regla.
    alerta = _validar_que_exista_alerta(cur, alerta_id)
    sensor = sensor_repo.buscar_por_id(cur, alerta["sensor_id"])
    rol_disp = dispositivo_service.rol_en_dispositivo(cur, sensor["dispositivo_id"], usuario_id, rol)
    if rol_disp is None:
        raise HTTPException(403, "No tienes acceso a este recurso")
    if roles_permitidos is not None and rol_disp not in roles_permitidos:
        raise HTTPException(403, "No tienes permisos para modificar alertas de este dispositivo")
    return alerta, rol_disp

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
    """
    por_sensor = defaultdict(list)
    for timestamp, sensor_id, value in filas:
        por_sensor[sensor_id].append((timestamp, value))

    reglas = alerta_repo.buscar_activas_por_sensores(cur, list(por_sensor.keys()))
    if not reglas:
        return []

    notificaciones = []

    for regla in reglas:
        lecturas = por_sensor.get(regla["sensor_id"], [])
        if not lecturas:
            continue

        estado = regla["estado"]
        estado_desde = regla["estado_desde"]
        ultima_evaluacion = regla["ultima_evaluacion_at"]
        ultimo_valor = regla["ultimo_valor"]
        transiciones = []

        for timestamp, value in lecturas:
            # Ya evaluada (reintento de un chunk, o dato que llegó fuera de
            # orden detrás de uno más nuevo): no se reevalúa ni se retrocede.
            if ultima_evaluacion is not None and timestamp <= ultima_evaluacion:
                continue

            nuevo_estado = _transicion(estado, regla["condicion"], regla["umbral"], regla["histeresis"], value)
            ultima_evaluacion = timestamp
            ultimo_valor = value

            if nuevo_estado != estado:
                transiciones.append({
                    "tipo": "disparada" if nuevo_estado == "disparada" else "normalizada",
                    "valor": value,
                    "medicion_at": timestamp,
                    "tardio": (ahora - timestamp) > FRESCURA,
                })
                estado = nuevo_estado
                estado_desde = timestamp

        if ultima_evaluacion == regla["ultima_evaluacion_at"]:
            continue  # todo lo que llegó ya estaba evaluado

        notificar_ultima = bool(transiciones)
        alerta_repo.actualizar_estado(
            cur, regla["id"], estado, estado_desde, ultimo_valor, ultima_evaluacion,
            notificada=notificar_ultima,
        )

        if not transiciones:
            continue

        filas_eventos = [
            (regla["id"], t["tipo"], t["valor"], t["medicion_at"], ahora, t["tardio"], 0, 0)
            for t in transiciones
        ]
        insertados = alerta_repo.insertar_eventos(cur, filas_eventos)
        ultimo_evento_id = insertados[-1]["id"]

        destinatarios = alerta_repo.destinatarios_de_alerta(cur, regla["id"])
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

def notificar_eventos(notificaciones: list[dict]) -> None:
    # Corre en un BackgroundTask, después de responder al dispositivo: Resend
    # es HTTP bloqueante y el ESP32 no puede esperarlo. Un destinatario que
    # rebota no frena a los demás (try/except por destinatario, igual que
    # auth_service con el mail de verificación).
    for notificacion in notificaciones:
        enviados = 0
        for destinatario in notificacion["destinatarios"]:
            try:
                enviar_email_alerta(destinatario["email"], notificacion)
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

        rol_disp = dispositivo_service.rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        if rol_disp not in dispositivo_service.ROLES_EDICION:
            raise HTTPException(403, "No tienes permisos para crear alertas en este dispositivo")

        # Límites de datos del dispositivo salen del plan de su dueño, no de
        # quien crea la alerta: un editor free puede crear en un equipo premium,
        # igual que hoy ya ve el historial completo de ese equipo.
        limites = plan_service.limites_de_dispositivo(cur, dispositivo_id)
        if not limites["puede_alertas"]:
            raise HTTPException(403, "El plan de este dispositivo no incluye alertas")
        if limites["max_alertas"] is not None and alerta_repo.contar_por_dispositivo(cur, dispositivo_id) >= limites["max_alertas"]:
            raise HTTPException(403, "Alcanzaste el límite de alertas de este dispositivo")

        return alerta_repo.crear(
            cur, alerta.sensor_id, usuario_id, alerta.nombre,
            alerta.condicion, alerta.umbral, alerta.histeresis,
        )

def listar_por_dispositivo(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        _validar_que_exista_dispositivo(cur, dispositivo_id)
        if dispositivo_service.rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol) is None:
            raise HTTPException(403, "No tienes acceso a este recurso")
        return alerta_repo.listar_por_dispositivo(cur, dispositivo_id, usuario_id)

def obtener_alerta(alerta_id, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        alerta, _ = _obtener_alerta_con_rol(cur, alerta_id, usuario_id, rol)
        return alerta

def actualizar_alerta(alerta_id, usuario_id, rol, cambios) -> dict:
    with get_cursor() as cur:
        _obtener_alerta_con_rol(cur, alerta_id, usuario_id, rol, dispositivo_service.ROLES_EDICION)
        return alerta_repo.actualizar(cur, alerta_id, cambios.nombre, cambios.umbral, cambios.histeresis, cambios.activa)

def eliminar_alerta(alerta_id, usuario_id, rol) -> None:
    with get_cursor() as cur:
        _obtener_alerta_con_rol(cur, alerta_id, usuario_id, rol, dispositivo_service.ROLES_EDICION)
        alerta_repo.eliminar(cur, alerta_id)

def actualizar_preferencia(alerta_id, usuario_id, rol, notificar: bool) -> dict:
    # Cualquier rol con acceso (viewer incluido) decide si quiere sus propios
    # mails de esta alerta, sin necesitar permiso de edición sobre la regla.
    with get_cursor() as cur:
        _obtener_alerta_con_rol(cur, alerta_id, usuario_id, rol)
        alerta_repo.upsert_preferencia(cur, alerta_id, usuario_id, notificar)
    return {"alerta_id": alerta_id, "notificar": notificar}

def obtener_eventos(alerta_id, usuario_id, rol, hasta, cursor, limite) -> dict:
    limite = min(limite or LIMITE_DEFAULT_EVENTOS, LIMITE_MAXIMO_EVENTOS)
    hasta = a_utc(hasta)
    cursor = a_utc(cursor)

    with get_cursor() as cur:
        _obtener_alerta_con_rol(cur, alerta_id, usuario_id, rol)
        filas = alerta_repo.listar_eventos_por_alerta(cur, alerta_id, hasta, cursor, limite)

    siguiente_cursor = filas[-1]["medicion_at"] if len(filas) == limite else None
    return {"eventos": filas, "siguiente_cursor": siguiente_cursor}

def eventos_por_dispositivo(dispositivo_id, usuario_id, rol, hasta, cursor, limite) -> dict:
    limite = min(limite or LIMITE_DEFAULT_EVENTOS, LIMITE_MAXIMO_EVENTOS)
    hasta = a_utc(hasta)
    cursor = a_utc(cursor)

    with get_cursor() as cur:
        _validar_que_exista_dispositivo(cur, dispositivo_id)
        if dispositivo_service.rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol) is None:
            raise HTTPException(403, "No tienes acceso a este recurso")
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
