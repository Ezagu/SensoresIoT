from pydantic import BaseModel
from typing import Optional

class TipoSensorCreate(BaseModel):
  nombre: str
  unidad: str
  valor_min: Optional[float] = None
  valor_max: Optional[float] = None

class TipoSensorOut(BaseModel):
  id: int
  nombre: str
  unidad: str
  valor_min: Optional[float] = None
  valor_max: Optional[float] = None