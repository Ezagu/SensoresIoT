from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class TipoSensorOut(BaseModel):
  nombre: str
  unidad: str

class SensorCreate(BaseModel):
  dispositivo_id: UUID
  tipo_sensor_id: int

class SensorOut(BaseModel):
  id: UUID
  dispositivo_id: UUID
  tipo_sensor_id: int
  activo: bool
  created_at: datetime

class SensorOutConTipo(BaseModel):
  id: UUID
  dispositivo_id: UUID
  tipo_sensor_id: int
  activo: bool
  created_at: datetime
  tipo_sensor: TipoSensorOut