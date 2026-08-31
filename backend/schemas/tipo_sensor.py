from pydantic import BaseModel

class TipoSensorCreate(BaseModel):
  nombre: str
  unidad: str

class TipoSensorOut(BaseModel):
  id: int
  nombre: str
  unidad: str
