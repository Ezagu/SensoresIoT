import math
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from core.security import generar_secret
from repositories import dispositivo_repo, sensor_repo, acceso_repo, alerta_repo
from services import plan_service
from db import get_cursor

ROLES_EDICION = ("admin", "owner", "editor")
ROLES_OWNER = ("admin", "owner")
ROLES_ASIGNABLES = ("editor", "viewer")

# Cada cuánto PUBLICA el equipo. El muestreo es fijo (15 s en el firmware) y no se configura por ahora.
PRESETS_INTERVALO_SEG = (60, 300, 900, 1800)
# Cada cuánto el equipo tiene que HABLAR, publique o no.
INTERVALO_CONTACTO_SEG = 300
# Cada cuánto el equipo debe muestrear en busca de eventos.
INTERVALO_MIN_MUESTREO_SEG = 15

INTERVALOS_DE_GRACIA = 3

VENTANA_SIN_REPORTAR_SEG = INTERVALO_CONTACTO_SEG * INTERVALOS_DE_GRACIA

def esta_online(last_seen_at, ahora=None) -> bool:
    # `ahora`: el barrido pasa el reloj de Postgres, el mismo de su filtro.
    if last_seen_at is None:
        return False
    transcurrido = (ahora or datetime.now(timezone.utc)) - last_seen_at
    return transcurrido < timedelta(seconds=VENTANA_SIN_REPORTAR_SEG)

# Celda Li-ion/LiPo en reposo, (mV, %): no es lineal, casi todo está entre 3,7 y 3,9 V.
# Cargando, la tensión sigue al cargador y marca de más.
CURVA_LI_ION = (
    (3270, 0), (3610, 5), (3690, 10), (3710, 15), (3730, 20), (3750, 25), (3770, 30),
    (3790, 35), (3800, 40), (3820, 45), (3840, 50), (3850, 55), (3870, 60), (3910, 65),
    (3950, 70), (3980, 75), (4020, 80), (4080, 85), (4110, 90), (4150, 95), (4200, 100),
)

def porcentaje_bateria(bateria_mv) -> int | None:
    if bateria_mv is None:
        return None
    if bateria_mv <= CURVA_LI_ION[0][0]:
        return 0
    for (mv_ant, pct_ant), (mv, pct) in zip(CURVA_LI_ION, CURVA_LI_ION[1:]):
        if bateria_mv <= mv:
            return round(pct_ant + (bateria_mv - mv_ant) / (mv - mv_ant) * (pct - pct_ant))
    return 100

def segundos_hasta_siguiente_medicion(last_seen_at, intervalo_efectivo_seg) -> int | None:
    # Cuánto falta para el próximo reporte esperado. None = nunca reportó, no hay
    # desde dónde contar.
    if last_seen_at is None:
        return None
    siguiente = last_seen_at + timedelta(seconds=intervalo_efectivo_seg)
    return max(0, math.ceil((siguiente - datetime.now(timezone.utc)).total_seconds()))

def validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol) -> dict:
    # Valida que exista el dispositivo, que el usuario esté vinculado y tenga permiso de edición
    dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
    rol_disp = rol_en_dispositivo(cur, dispositivo["id"], usuario_id, rol)
    if rol_disp not in ROLES_OWNER:
        raise HTTPException(403, "Tu rol en este dispositivo no te permite realizar esta acción")
    return dispositivo

def validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol) -> dict:
    # Valida que exista el dispositivo, que el usuario esté vinculado y tenga permiso de edición
    dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
    rol_disp = rol_en_dispositivo(cur, dispositivo["id"], usuario_id, rol)
    if rol_disp not in ROLES_EDICION:
        raise HTTPException(403, "Tu rol en este dispositivo no te permite realizar esta acción")
    return dispositivo

def validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol) -> dict:
    # Valida que exista el dispositivo y que el usuario esté vinculado
    dispositivo = validar_que_exista_dispositivo(cur, dispositivo_id)
    rol_disp = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
    if not rol_disp:
        raise HTTPException(403, "No tienes acceso a este recurso")
    return dispositivo

def validar_que_exista_dispositivo(cur, dispositivo_id) -> dict:
    # Valida que exista el dispositivo y lo devuelve
    dispositivo = dispositivo_repo.buscar_por_id_publico(cur, dispositivo_id)
    if dispositivo is None:
        raise HTTPException(404, "dispositivo no existe")
    return dispositivo

def rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol) -> str | None:
    # 'admin' | 'owner' | 'editor' | 'viewer' | None (sin acceso).
    # Admin primero: es soporte, no pasa por usuario_dispositivo.
    if rol == "admin":
        return "admin"
    return acceso_repo.buscar_rol_en_dispositivo(cur, dispositivo_id, usuario_id)

def obtener_detalle_dispositivo(cur, dispositivo: dict, usuario_id, rol):
    dispositivo_id = dispositivo["id"]

    dispositivo["rol"] = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
    dispositivo["owner_nombre"] = acceso_repo.buscar_nombre_owner(cur, dispositivo_id)
    limites = plan_service.limites_de_dispositivo(cur, dispositivo_id)
    dispositivo["limites"] = {
        "puede_alertas": limites["puede_alertas"],
        "max_alertas": limites["max_alertas"],
        "intervalo_minimo_seg": limites["intervalo_minimo_seg"],
        "intervalos_disponibles": intervalos_disponibles(limites["intervalo_minimo_seg"]),
    }
    dispositivo["intervalo_efectivo_seg"] = plan_service.intervalo_efectivo_seg(
        dispositivo["intervalo_configurado_seg"], limites["intervalo_minimo_seg"]
    )
    dispositivo["notificar"] = acceso_repo.buscar_notificar(cur, dispositivo_id, usuario_id)
    dispositivo["bateria_porcentaje"] = porcentaje_bateria(dispositivo["bateria_mv"])
    return dispositivo

#-----------------ENDPOINTS----------------------

def crear_dispositivo(dispositivo) -> dict:
    # El secret sólo sale en texto plano acá; se persiste únicamente el hash.
    secret, secret_hash = generar_secret()
    with get_cursor() as cur:
        creado = dispositivo_repo.crear(cur, dispositivo.nombre, dispositivo.ubicacion, secret_hash)
    return {"dispositivo": creado, "secret": secret}

def obtener_dispositivo(dispositivo_id, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return obtener_detalle_dispositivo(cur, dispositivo, usuario_id, rol)

def obtener_estado(dispositivo_id, usuario_id, rol) -> dict:
    # Lo único que cambia solo mientras se mira un equipo. El resto del detalle
    # sale de GET /dispositivos/{id}, que no hace falta pollear.
    with get_cursor() as cur:
        dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        last_seen_at = dispositivo["last_seen_at"]
        piso = plan_service.limites_de_dispositivo(cur, dispositivo_id)["intervalo_minimo_seg"]
        intervalo = plan_service.intervalo_efectivo_seg(dispositivo["intervalo_configurado_seg"], piso)
        return {
            "last_seen_at": last_seen_at,
            "last_data_at": dispositivo["last_data_at"],
            "online": esta_online(last_seen_at),
            "alertas_disparadas": len(alerta_repo.disparadas_por_dispositivos(cur, [dispositivo_id])),
            # Sigue colgando del intervalo de PUBLICACIÓN: es cuándo llega el
            # próximo dato, no cuándo vuelve a hablar el equipo.
            "siguiente_medicion": segundos_hasta_siguiente_medicion(dispositivo["last_data_at"], intervalo),
            "intervalo_modificado_at": dispositivo["intervalo_modificado_at"],
        }

def actualizar_datos(dispositivo_id, usuario_id, rol, datos):
    campos = datos.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(400, "No se enviaron campos para actualizar")
    
    with get_cursor() as cur:
        validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        dispositivo = dispositivo_repo.actualizar(cur, dispositivo_id, campos)
        return obtener_detalle_dispositivo(cur, dispositivo, usuario_id, rol)

def obtener_sensores(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return sensor_repo.buscar_por_dispositivo_id(cur, dispositivo_id)

def configurar_notificaciones(dispositivo_id, usuario_id, notificar: bool) -> dict:
    # Opt-out de los mails de alerta de este equipo. Cualquier rol decide el
    # suyo (viewer incluido): no es una edición del equipo. El UPDATE acotado al
    # par (dispositivo, usuario) es a la vez la autorización — sin vínculo no
    # afecta ninguna fila.
    with get_cursor() as cur:
        if not acceso_repo.actualizar_notificar(cur, dispositivo_id, usuario_id, notificar):
            raise HTTPException(404, "No tenés acceso directo a este dispositivo")
    return {"notificar": notificar}

def intervalos_disponibles(piso: int) -> list[int]:
    # El piso del plan recorta la lista; el free queda con menos opciones y el
    # control se dibuja igual, sin caso especial.
    return [p for p in PRESETS_INTERVALO_SEG if p >= piso]

def configurar_intervalo(dispositivo_id, usuario_id, rol, intervalo_seg) -> dict:
    # Cambiar cada cuánto publica el dispositivo; viaja de vuelta como
    # intervalo_sugerido en la respuesta de /mediciones/.
    with get_cursor() as cur:
        validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        piso = plan_service.limites_de_dispositivo(cur, dispositivo_id)["intervalo_minimo_seg"]
        disponibles = intervalos_disponibles(piso)

        # None = automático, se queda con el piso del plan.
        if intervalo_seg is not None and intervalo_seg not in disponibles:
            raise HTTPException(400, f"Intervalos permitidos por tu plan: {disponibles}")

        dispositivo_repo.actualizar_intervalo(cur, dispositivo_id, intervalo_seg)
        efectivo = plan_service.intervalo_efectivo_seg(intervalo_seg, piso)

    return {"intervalo_configurado_seg": intervalo_seg, "intervalo_efectivo_seg": efectivo}

#------------SECRET-------------

def regenerar_secret_dispositivo(dispositivo_id) -> dict:
    # Uso de banco/fábrica: requiere reflashear el equipo con el secret devuelto.
    secret, secret_hash = generar_secret()
    with get_cursor() as cur:
        actualizado = dispositivo_repo.actualizar_secret(cur, dispositivo_id, secret_hash)
    if not actualizado:
        raise HTTPException(404, "Dispositivo no encontrado")
    return {"secret": secret}

def marcar_rotacion_pendiente(dispositivo_id) -> dict:
    # Activar flag para que dispositivo rote de secret
    with get_cursor() as cur:
        marcado = dispositivo_repo.marcar_rotacion_pendiente(cur, dispositivo_id)
    if not marcado:
        raise HTTPException(404, "Dispositivo no encontrado")
    return {"detail": "El dispositivo va a rotar su secret en la próxima conexión"}

def rotar_secret_dispositivo(dispositivo_id) -> dict:
    # Mismo dispositivo solicita rotar secret mediante una flag recibida
    secret, secret_hash = generar_secret()
    with get_cursor() as cur:
        rotado = dispositivo_repo.rotar_secret(cur, dispositivo_id, secret_hash)
    if not rotado:
        raise HTTPException(404, "Dispositivo no encontrado")
    return {"secret": secret}
