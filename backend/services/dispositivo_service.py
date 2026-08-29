import psycopg2.extras
from fastapi import HTTPException
from repositories import dispositivo_repo, sensor_repo
from db import get_connection

def _validar_que_exista_dispositivo(cur, dispositivo_id) -> dict:
    # Valida que exista el dispositivo, tira error o devuelve el dispositivo
    dispositivo = dispositivo_repo.buscar_por_id_publico(cur, dispositivo_id)
    if dispositivo is None:
        raise HTTPException(404, "dispositivo no existe")
    return dispositivo

def _obtener_dispositivo_con_acceso(cur, dispositivo_id, usuario_id, rol) -> dict:
    # Devuelve el dispositivo si el usuario esta vinculado a este o es admin
    dispositivo = _validar_que_exista_dispositivo(cur, dispositivo_id)
    if not tiene_acceso_a_dispositivo(cur, dispositivo_id, usuario_id, rol):
        raise HTTPException(403, "No tienes acceso a este recurso")
    return dispositivo

def tiene_acceso_a_dispositivo(cur, dispositivo_id, usuario_id, rol):
    # Indica si el usuario esta vinculado al dispositivo o si es admin
    es_owner = dispositivo_repo.verificar_ownership_dispositivo(cur, dispositivo_id, usuario_id)
    es_admin = rol == "admin"
    return es_owner or es_admin

def crear_dispositivo(dispositivo) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return dispositivo_repo.crear(cur, dispositivo.nombre, dispositivo.ubicacion, dispositivo.descripcion)

def obtener_dispositivo(dispositivo_id, usuario_id, rol) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return _obtener_dispositivo_con_acceso(cur, dispositivo_id, usuario_id, rol)

def obtener_sensores(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _obtener_dispositivo_con_acceso(cur, dispositivo_id, usuario_id, rol)
            return sensor_repo.buscar_por_dispositivo_id(cur, dispositivo_id)

def regenerar_secret_dispositivo(dispositivo_id) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _validar_que_exista_dispositivo(cur, dispositivo_id)
            secret = dispositivo_repo.actualizar_secret(cur, dispositivo_id)
            return {"secret": secret}

def crear_vinculacion(usuario_id, dispositivo_id, rol):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            _validar_que_exista_dispositivo(cur, dispositivo_id)
            
            if rol == "owner":
                has_owner = dispositivo_repo.buscar_owner_de_dispositivo(cur, dispositivo_id)
                if has_owner is not None:
                    raise HTTPException(409, "el dispositivo ya tiene un dueño")

            return dispositivo_repo.crear_vinculacion(cur, usuario_id, dispositivo_id, rol)

def rotar_secret_dispositivo(dispositivo_id) -> dict:
    # Rotación device-initiated: no valida ownership porque el dispositivo ya se
    # autenticó a sí mismo y sólo puede rotar el suyo (el id sale del token, no de la URL)
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            secret = dispositivo_repo.rotar_secret(cur, dispositivo_id)
            return {"secret": secret}

def marcar_rotacion_pendiente(dispositivo_id) -> dict:
    # Uso interno/admin: fuerza a que el dispositivo rote su secret en la próxima conexión
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            dispositivo_repo.marcar_rotacion_pendiente(cur, dispositivo_id)
            return {"detail": "El dispositivo va a rotar su secret en la próxima conexión"}
