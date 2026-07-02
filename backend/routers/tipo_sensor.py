import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from db import get_connection

router = APIRouter()

class TipoSensorCreate(BaseModel):
  nombre: str
  unidad: str
  valor_min: Optional[float] = None
  valor_max: Optional[float] = None

@router.post("/")
def create_tipo_sensor(tipo_sensor: TipoSensorCreate):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      try:
        cur.execute(
          """
          INSERT INTO tipos_sensor (nombre, unidad, valor_min, valor_max)
          VALUES (%s, %s, %s, %s)
          RETURNING *
          """,
          (tipo_sensor.nombre, tipo_sensor.unidad, tipo_sensor.valor_min, tipo_sensor.valor_max)
        )
        return cur.fetchone()
      except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Ya existe un tipo de sensor con ese nombre")
