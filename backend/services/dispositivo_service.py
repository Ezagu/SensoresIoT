import math
import psycopg2.errors
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from repositories import dispositivo_repo, sensor_repo, usuario_repo, alerta_repo, invitacion_dispositivo_repo
from services import plan_service
from core.security import generar_secret_urlsafe, hashear_sha256
from db import get_cursor

INTERVALO_MAXIMO_SEG = 24 * 60 * 60
ROLES_EDICION = ("admin", "owner", "editor")
ROLES_OWNER = ("admin", "owner")
ROLES_ASIGNABLES = ("editor", "viewer")

# Toleramos tres intervalos de silencio antes de dar por caído al equipo: uno
# perdido es un reintento normal del firmware.
INTERVALOS_DE_GRACIA = 3

def esta_online(last_seen_at, intervalo_efectivo_seg) -> bool:
    # El intervalo tiene que ser el EFECTIVO (max con el piso del plan del dueño):
    # el configurado es NULL cuando el equipo está en automático.
    if last_seen_at is None:
        return False
    transcurrido = datetime.now(timezone.utc) - last_seen_at
    return transcurrido < timedelta(seconds=intervalo_efectivo_seg * INTERVALOS_DE_GRACIA)

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
    # 'admin' | 'owner' | 'editor' | 'viewer' | None (sin acceso). Admin
    # primero: es soporte, no pasa por usuario_dispositivo.
    if rol == "admin":
        return "admin"
    return dispositivo_repo.buscar_rol_en_dispositivo(cur, dispositivo_id, usuario_id)

def obtener_detalle_dispositivo(cur, dispositivo: dict, usuario_id, rol):
    dispositivo_id = dispositivo["id"]

    dispositivo["rol"] = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
    dispositivo["owner_nombre"] = dispositivo_repo.buscar_nombre_owner(cur, dispositivo_id)
    limites = plan_service.limites_de_dispositivo(cur, dispositivo_id)
    dispositivo["limites"] = {
        "puede_alertas": limites["puede_alertas"],
        "max_alertas": limites["max_alertas"],
        "intervalo_minimo_seg": limites["intervalo_minimo_seg"],
    }
    dispositivo["intervalo_efectivo_seg"] = plan_service.intervalo_efectivo_seg(
        dispositivo["intervalo_configurado_seg"], limites["intervalo_minimo_seg"]
    )
    dispositivo["notificar"] = dispositivo_repo.buscar_notificar(cur, dispositivo_id, usuario_id)
    return dispositivo

#-----------------ENDPOINTS----------------------

def crear_dispositivo(dispositivo) -> dict:
    with get_cursor() as cur:
        return dispositivo_repo.crear(cur, dispositivo.nombre, dispositivo.ubicacion, dispositivo.descripcion)

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
            "online": esta_online(last_seen_at, intervalo),
            "alertas_disparadas": len(alerta_repo.disparadas_por_dispositivos(cur, [dispositivo_id])),
            "siguiente_medicion": segundos_hasta_siguiente_medicion(last_seen_at, intervalo),
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

def obtener_accesos(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return dispositivo_repo.listar_accesos(cur, dispositivo_id)

def crear_vinculacion_owner(usuario_id, dispositivo_id):
    # Vincular un dispositivo a una cuenta como dueño
    with get_cursor() as cur:
        validar_que_exista_dispositivo(cur, dispositivo_id)

        owner = dispositivo_repo.buscar_owner_de_dispositivo(cur, dispositivo_id)
        if owner is not None:
            raise HTTPException(409, "el dispositivo ya tiene un dueño")

        try:
            return dispositivo_repo.crear_vinculacion(cur, usuario_id, dispositivo_id, "owner")
        except psycopg2.errors.UniqueViolation:
            raise HTTPException(409, "el dispositivo ya tiene un dueño")  # condición de carrera

def crear_invitacion(dispositivo_id, usuario_id, rol, rol_dispositivo, email = None) -> dict:
    if rol_dispositivo not in ROLES_ASIGNABLES:
        raise HTTPException(409, f"No se puede asignar el rol {rol_dispositivo}")
    
    with get_cursor() as cur:
        validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        limites = plan_service.limites_de_usuario(cur, usuario_id)

        if not limites["puede_compartir"]:
            raise HTTPException(409, "Tu plan actual no permite compartir dispositivos")
        
        if email is None:
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        else:
            expires_at = None

        token, token_hash = generar_secret_urlsafe()

        invitacion_dispositivo_repo.crear(cur, dispositivo_id, rol_dispositivo, token_hash, expires_at, email)

        return token

def aceptar_invitacion(dispositivo_id, token, usuario_id) -> dict:
    with get_cursor() as cur:
        validar_que_exista_dispositivo(cur, dispositivo_id)

        token_hash = hashear_sha256(token)

        invitacion = invitacion_dispositivo_repo.buscar(cur, dispositivo_id, token_hash)

        if invitacion is None:
            raise HTTPException(404, "invitación no existe o ya fue usada")
        
        if invitacion["expires_at"] is not None and invitacion["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(409, "invitación expirada")

        if invitacion["email"] is not None and invitacion["email"] != usuario_repo.buscar_email(cur, usuario_id):
            raise HTTPException(409, "invitación no corresponde al email de tu cuenta")

        try:
            dispositivo_repo.crear_vinculacion(cur, usuario_id, dispositivo_id, invitacion["rol"])

            if invitacion["email"] is not None:
                invitacion_dispositivo_repo.eliminar(cur, dispositivo_id, token_hash)
        except psycopg2.errors.UniqueViolation:
            raise HTTPException(409, "ya tenés acceso a este dispositivo")  # condición de carrera

def actualizar_rol(dispositivo_id, usuario_id_to_change, rol_to_change, usuario_id, rol):
    if rol_to_change not in ROLES_ASIGNABLES:
        raise HTTPException(409, f"No se puede asignar el rol {rol_to_change}")
    
    with get_cursor() as cur:
        validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        usuario = usuario_repo.buscar_por_id(cur, usuario_id_to_change)
        if not usuario:
            raise HTTPException(409, f"El usuario no existe")
        
        return dispositivo_repo.cambiar_rol(cur, dispositivo_id, usuario_id_to_change, rol_to_change)

def quitar_acceso(dispositivo_id, usuario_id_to_delete, usuario_id, rol):
    with get_cursor() as cur:
        validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        rol_disp = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        if str(usuario_id_to_delete) != str(usuario_id) and rol_disp not in ROLES_OWNER:
            raise HTTPException(409, "No tienes permiso para quitar el acceso de este usuario")
        
        if rol_disp == "owner" and str(usuario_id_to_delete) == str(usuario_id):
            raise HTTPException(409, "Debes transferir la propiedad del dispositivo antes de quitar tu acceso")
        
        dispositivo_repo.eliminar_vinculacion(cur, dispositivo_id, usuario_id_to_delete)

def configurar_notificaciones(dispositivo_id, usuario_id, notificar: bool) -> dict:
    # Opt-out de los mails de alerta de este equipo. Cualquier rol decide el
    # suyo (viewer incluido): no es una edición del equipo. El UPDATE acotado al
    # par (dispositivo, usuario) es a la vez la autorización — sin vínculo no
    # afecta ninguna fila.
    with get_cursor() as cur:
        if not dispositivo_repo.actualizar_notificar(cur, dispositivo_id, usuario_id, notificar):
            raise HTTPException(404, "No tenés acceso directo a este dispositivo")
    return {"notificar": notificar}

def configurar_intervalo(dispositivo_id, usuario_id, rol, intervalo_seg) -> dict:
    # Cambiar intervalo de medición del dispositivo, se devuelve como respuesta en la medición
    with get_cursor() as cur:
        validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        piso = plan_service.limites_de_dispositivo(cur, dispositivo_id)["intervalo_minimo_seg"]

        if intervalo_seg is not None:
            if intervalo_seg > INTERVALO_MAXIMO_SEG:
                raise HTTPException(400, "El intervalo máximo permitido es 24 horas")
            if intervalo_seg < piso:
                raise HTTPException(400, f"Tu plan actual permite un mínimo de {piso}s")

        dispositivo_repo.actualizar_intervalo(cur, dispositivo_id, intervalo_seg)
        efectivo = plan_service.intervalo_efectivo_seg(intervalo_seg, piso)

    return {"intervalo_configurado_seg": intervalo_seg, "intervalo_efectivo_seg": efectivo}

#------------SECRET-------------

def regenerar_secret_dispositivo(dispositivo_id) -> dict:
    # Uso solo de admin, reflashear firmware manualmente con secret nuevo
    with get_cursor() as cur:
        validar_que_exista_dispositivo(cur, dispositivo_id)
        secret = dispositivo_repo.actualizar_secret(cur, dispositivo_id)
        return {"secret": secret}

def marcar_rotacion_pendiente(dispositivo_id) -> dict:
    # Activar flag para que dispositivo rote de secret
    with get_cursor() as cur:
        dispositivo_repo.marcar_rotacion_pendiente(cur, dispositivo_id)
        return {"detail": "El dispositivo va a rotar su secret en la próxima conexión"}

def rotar_secret_dispositivo(dispositivo_id) -> dict:
    # Mismo dispositivo solicita rotar secret mediante una flag recibida
    with get_cursor() as cur:
        secret = dispositivo_repo.rotar_secret(cur, dispositivo_id)
        return {"secret": secret}
