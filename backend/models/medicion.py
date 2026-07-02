from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MedicionCreate(BaseModel):
    sensor_id: str
    value: float
    time: Optional[datetime] = None

class MedicionOut(BaseModel):
    value: float
    time: datetime

class ResumenOut(BaseModel):
  promedio: float | None
  minimo: float | None
  maximo: float | None

class MedicionAgregadaOut(BaseModel):
  bucket: datetime
  promedio: float
  minimo: float
  maximo: float

class DatosGraficoOut(BaseModel):
  puntos: list[MedicionAgregadaOut]
  resumen: ResumenOut