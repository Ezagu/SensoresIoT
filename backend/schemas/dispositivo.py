from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

class DispositivoCreate(BaseModel):
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None

class DispositivoOut(BaseModel):
  id: UUID
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None
  activo: bool
  last_seen_at: Optional[datetime]
  first_connected_at: Optional[datetime]
  # None = automático, usa el piso del plan vigente en cada momento
  intervalo_configurado_seg: Optional[int] = None

class DispositivoConRolOut(DispositivoOut):
  # Solo el listado por usuario: el rol sale de usuario_dispositivo, no del
  # dispositivo, asi que el resto de los endpoints no tiene de donde sacarlo.
  rol: str

class DispositivoCreateOut(BaseModel):
  dispositivo: DispositivoOut
  secret: str

class IntervaloUpdate(BaseModel):
  # None = automático (resetea a "usar el piso del plan vigente")
  intervalo_seg: Optional[int] = None