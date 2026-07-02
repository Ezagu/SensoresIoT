import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

from db import get_connection

router = APIRouter()

class DispositivoCreate(BaseModel):
  usuario_id: UUID
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None

class DispositivoOut(BaseModel):
  id: UUID
  usuario_id: UUID
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None
  activo: bool
  last_seen_at: Optional[datetime]
  created_at: datetime


@router.post("/", response_model=DispositivoOut)
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

@router.get("/{dispositivo_id}", response_model=DispositivoOut)
def get_dispositivo_by_id(dispositivo_id: UUID):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      cur.execute("SELECT * FROM dispositivos WHERE id = %s", (dispositivo_id,))
      dispositivo = cur.fetchone()
      if dispositivo is None:
        raise HTTPException(404, "dispositivo no existe")
      return dispositivo