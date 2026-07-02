import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID
from typing import Optional

from db import get_connection

router = APIRouter()

class SensorCreate(BaseModel):
  dispositivo_id: UUID
  tipo_sensor_id: int
  nombre: Optional[str] = None

@router.post("/")
def create_sensor(sensor: SensorCreate):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      try:
        cur.execute(
          """
          INSERT INTO sensores (dispositivo_id, tipo_sensor_id, nombre)
          VALUES (%s, %s, %s)
          RETURNING *
          """,
          (sensor.dispositivo_id, sensor.tipo_sensor_id, sensor.nombre)
        )
        return cur.fetchone()
      except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(404, "dispositivo_id o tipo_sensor_id no existen")