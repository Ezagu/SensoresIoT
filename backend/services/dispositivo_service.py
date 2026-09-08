import psycopg2.errors
from fastapi import HTTPException
from repositories import dispositivo_repo, sensor_repo
from services import plan_service
from db import get_cursor

INTERVALO_MAXIMO_SEG = 24 * 60 * 60
ROLES_EDICION = ("admin", "owner", "editor")

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

def crear_dispositivo(dispositivo) -> dict:
    with get_cursor() as cur:
        return dispositivo_repo.crear(cur, dispositivo.nombre, dispositivo.ubicacion, dispositivo.descripcion)

def obtener_dispositivo(dispositivo_id, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        dispositivo["rol"] = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        dispositivo["owner_nombre"] = dispositivo_repo.buscar_nombre_owner(cur, dispositivo_id)
        # Del plan del dueño, no del de quien consulta: es el mismo criterio que
        # aplica alerta_service al gatear la creación de reglas.
        limites = plan_service.limites_de_dispositivo(cur, dispositivo_id)
        dispositivo["limites"] = {
            "puede_alertas": limites["puede_alertas"],
            "max_alertas": limites["max_alertas"],
            "intervalo_minimo_seg": limites["intervalo_minimo_seg"],
        }
        return dispositivo

def obtener_sensores(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return sensor_repo.buscar_por_dispositivo_id(cur, dispositivo_id)

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
