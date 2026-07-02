import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

from db import get_connection

router = APIRouter()

class SensorCreate(BaseModel):
  dispositivo_id: UUID
  tipo_sensor_id: int
  nombre: Optional[str] = None

class SensorOut(BaseModel):
  id: UUID
  dispositivo_id: UUID
  tipo_sensor_id: int
  nombre: Optional[str] = None
  activo: bool
  created_at: datetime

@router.post("/", response_model=SensorOut)
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
      
@router.get("/{sensor_id}", response_model=SensorOut)
def get_sensor_by_id(sensor_id: UUID):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      cur.execute("SELECT * FROM sensores WHERE id = %s", (sensor_id,))
      sensor = cur.fetchone()
      if sensor is None:
        raise HTTPException(404, "sensor no existe")
      return sensor