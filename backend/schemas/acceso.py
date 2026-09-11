from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class AccesoDispositivoUpdate(BaseModel):
  rol: str

class AccesoDispositivoOut(BaseModel):
  usuario_id: UUID
  nombre: str
  email: str
  rol: str
  created_at: datetime
