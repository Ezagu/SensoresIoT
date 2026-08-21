from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Medicion(BaseModel):
    sensor_id: str
    value: float

class MedicionCreate(BaseModel):
    dispositivo_id: str
    time: Optional[datetime] = None
    mediciones: list[Medicion]

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