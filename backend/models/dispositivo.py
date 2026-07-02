from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

class DispositivoCreate(BaseModel):
  usuario_id: UUID
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None

class DispositivoOut(BaseModel):
  id: UUID
  usuario_id: UUID
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None
  activo: bool
  last_seen_at: Optional[datetime]
  created_at: datetime