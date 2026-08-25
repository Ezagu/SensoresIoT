import psycopg2.extras
from fastapi import HTTPException
from uuid import UUID
from repositories import dispositivo_repo, sensor_repo
from services import dispositivo_service
from db import get_connection


def crear_dispositivo(dispositivo) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return dispositivo_repo.crear(
                cur, dispositivo.usuario_id, dispositivo.nombre, 
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