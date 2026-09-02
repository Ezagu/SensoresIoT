import psycopg2.errors
from fastapi import HTTPException
from repositories import dispositivo_repo, sensor_repo
from services import plan_service
from db import get_cursor

INTERVALO_MAXIMO_SEG = 24 * 60 * 60
ROLES_EDICION = ("admin", "owner", "editor")

def _validar_que_exista_dispositivo(cur, dispositivo_id) -> dict:
    dispositivo = dispositivo_repo.buscar_por_id_publico(cur, dispositivo_id)
    if dispositivo is None:
        raise HTTPException(404, "dispositivo no existe")
    return dispositivo

def _obtener_dispositivo_con_acceso(cur, dispositivo_id, usuario_id, rol) -> dict:
    dispositivo = _validar_que_exista_dispositivo(cur, dispositivo_id)
    if not tiene_acceso_a_dispositivo(cur, dispositivo_id, usuario_id, rol):
        raise HTTPException(403, "No tienes acceso a este recurso")
    return dispositivo

def tiene_acceso_a_dispositivo(cur, dispositivo_id, usuario_id, rol):
    es_owner = dispositivo_repo.verificar_ownership_dispositivo(cur, dispositivo_id, usuario_id)
    es_admin = rol == "admin"
    return es_owner or es_admin

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
        dispositivo = _obtener_dispositivo_con_acceso(cur, dispositivo_id, usuario_id, rol)
        dispositivo["rol"] = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        dispositivo["owner_nombre"] = dispositivo_repo.buscar_nombre_owner(cur, dispositivo_id)
        return dispositivo

def obtener_sensores(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        _obtener_dispositivo_con_acceso(cur, dispositivo_id, usuario_id, rol)
        return sensor_repo.buscar_por_dispositivo_id(cur, dispositivo_id)

def regenerar_secret_dispositivo(dispositivo_id) -> dict:
    with get_cursor() as cur:
        _validar_que_exista_dispositivo(cur, dispositivo_id)
        secret = dispositivo_repo.actualizar_secret(cur, dispositivo_id)
        return {"secret": secret}

def crear_vinculacion(usuario_id, dispositivo_id, rol):
    with get_cursor() as cur:
        _validar_que_exista_dispositivo(cur, dispositivo_id)

        if rol == "owner":
            has_owner = dispositivo_repo.buscar_owner_de_dispositivo(cur, dispositivo_id)
            if has_owner is not None:
                raise HTTPException(409, "el dispositivo ya tiene un dueño")

        try:
            return dispositivo_repo.crear_vinculacion(cur, usuario_id, dispositivo_id, rol)
        except psycopg2.errors.UniqueViolation:
            raise HTTPException(409, "el dispositivo ya tiene un dueño")  # condición de carrera

def rotar_secret_dispositivo(dispositivo_id) -> dict:
    # No valida ownership: el dispositivo ya se autenticó a sí mismo y sólo puede
    # rotar el suyo (el id sale del token, no de la URL).
    with get_cursor() as cur:
        secret = dispositivo_repo.rotar_secret(cur, dispositivo_id)
        return {"secret": secret}

def configurar_intervalo(dispositivo_id, usuario_id, rol, intervalo_seg) -> dict:
    with get_cursor() as cur:
        _obtener_dispositivo_con_acceso(cur, dispositivo_id, usuario_id, rol)

        piso = plan_service.limites_de_dispositivo(cur, dispositivo_id)["intervalo_minimo_seg"]

        if intervalo_seg is not None:
            if intervalo_seg > INTERVALO_MAXIMO_SEG:
                raise HTTPException(400, "El intervalo máximo permitido es 24 horas")
            if intervalo_seg < piso:
                raise HTTPException(400, f"Tu plan actual permite un mínimo de {piso}s")

        dispositivo_repo.actualizar_intervalo(cur, dispositivo_id, intervalo_seg)
        efectivo = plan_service.intervalo_efectivo_seg(intervalo_seg, piso)

    return {"intervalo_configurado_seg": intervalo_seg, "intervalo_efectivo_seg": efectivo}

def marcar_rotacion_pendiente(dispositivo_id) -> dict:
    # Uso interno/admin: fuerza a que el dispositivo rote su secret en la próxima conexión
    with get_cursor() as cur:
        dispositivo_repo.marcar_rotacion_pendiente(cur, dispositivo_id)
        return {"detail": "El dispositivo va a rotar su secret en la próxima conexión"}
