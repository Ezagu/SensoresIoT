import psycopg2.extras
from fastapi import HTTPException
from repositories import dispositivo_repo, sensor_repo, usuario_repo
from db import get_connection


def crear_dispositivo(dispositivo) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return dispositivo_repo.crear(
                cur, dispositivo.nombre, 
                dispositivo.ubicacion, dispositivo.descripcion
            )

def obtener_dispositivo(dispositivo_id) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            dispositivo = dispositivo_repo.buscar_por_id(cur, dispositivo_id)
            if dispositivo is None:
                raise HTTPException(404, "dispositivo no existe")
            return dispositivo

def obtener_sensores(dispositivo_id) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            dispositivo = dispositivo_repo.buscar_por_id(cur, dispositivo_id)
            if dispositivo is None:
                raise HTTPException(404, "dispositivo no existe")
            return sensor_repo.buscar_por_dispositivo_id(cur, dispositivo_id)

def regenerar_secret_dispositivo(dispositivo_id) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            secret = dispositivo_repo.actualizar_secret(cur, dispositivo_id)
            return {"secret": secret}

def crear_vinculacion(usuario_id, dispositivo_id, rol):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            usuario = usuario_repo.buscar_por_id(cur, usuario_id)
            if usuario is None:
                raise HTTPException(404, "usuario no existe")
            dispositivo = dispositivo_repo.buscar_por_id(cur, dispositivo_id)
            if dispositivo is None:
                raise HTTPException(404, "dispositivo no existe")
            
            if rol == "owner":
                has_owner = dispositivo_repo.buscar_owner_de_dispositivo(cur, dispositivo_id)
                if has_owner is not None:
                    raise HTTPException(409, "el dispositivo ya tiene un dueño")

            return dispositivo_repo.crear_vinculacion(cur, usuario_id, dispositivo_id, rol)