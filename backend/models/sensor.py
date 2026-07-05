from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

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

class TipoSensorOut(BaseModel):
  nombre: str
  unidad: str