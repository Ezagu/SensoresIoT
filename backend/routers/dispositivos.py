import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID
from typing import Optional

from db import get_connection

router = APIRouter()

class DispositivoCreate(BaseModel):
  usuario_id: UUID
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None

@router.post("/")
def create_dispositivo(dispositivo: DispositivoCreate):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      try:
        cur.execute(
          """
          INSERT INTO dispositivos (usuario_id, nombre, ubicacion, descripcion)
          VALUES (%s, %s, %s, %s)
          RETURNING *
          """,
          (dispositivo.usuario_id, dispositivo.nombre, dispositivo.ubicacion, dispositivo.descripcion)
        )
        return cur.fetchone()
      except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(404, "usuario_id no existe")