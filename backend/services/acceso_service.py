import psycopg2.errors
from fastapi import HTTPException
from repositories import acceso_repo, usuario_repo
from services import dispositivo_service
from services.dispositivo_service import ROLES_OWNER, ROLES_ASIGNABLES
from db import get_cursor

def obtener_accesos(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        dispositivo_service.validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return acceso_repo.listar_accesos(cur, dispositivo_id)

def crear_vinculacion_owner(usuario_id, dispositivo_id):
    # Vincular un dispositivo a una cuenta como dueño
    with get_cursor() as cur:
        dispositivo_service.validar_que_exista_dispositivo(cur, dispositivo_id)

        owner = acceso_repo.buscar_owner_de_dispositivo(cur, dispositivo_id)
        if owner is not None:
            raise HTTPException(409, "el dispositivo ya tiene un dueño")

        try:
            return acceso_repo.crear_vinculacion(cur, usuario_id, dispositivo_id, "owner")
        except psycopg2.errors.UniqueViolation:
            raise HTTPException(409, "el dispositivo ya tiene un dueño")  # condición de carrera

def actualizar_rol(dispositivo_id, usuario_id_to_change, rol_to_change, usuario_id, rol):
    if rol_to_change not in ROLES_ASIGNABLES:
        raise HTTPException(409, f"No se puede asignar el rol {rol_to_change}")

    with get_cursor() as cur:
        dispositivo_service.validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        usuario = usuario_repo.buscar_por_id(cur, usuario_id_to_change)
        if not usuario:
            raise HTTPException(409, f"El usuario no existe")

        return acceso_repo.cambiar_rol(cur, dispositivo_id, usuario_id_to_change, rol_to_change)

def quitar_acceso(dispositivo_id, usuario_id_to_delete, usuario_id, rol):
    with get_cursor() as cur:
        dispositivo_service.validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        rol_disp = dispositivo_service.rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        if str(usuario_id_to_delete) != str(usuario_id) and rol_disp not in ROLES_OWNER:
            raise HTTPException(409, "No tienes permiso para quitar el acceso de este usuario")

        if rol_disp == "owner" and str(usuario_id_to_delete) == str(usuario_id):
            raise HTTPException(409, "Debes transferir la propiedad del dispositivo antes de quitar tu acceso")

        acceso_repo.eliminar_vinculacion(cur, dispositivo_id, usuario_id_to_delete)
