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
  # Listado por usuario: acá el rol sale directo de la fila de usuario_dispositivo
  # del join, sin resolver nada — a diferencia de DispositivoDetalleOut, que lo
  # calcula (contempla el admin, que no tiene fila propia).
  rol: str

class DispositivoDetalleOut(DispositivoOut):
  # GET /dispositivos/{id}: acá sí hace falta resolver el rol (rol_en_dispositivo,
  # que contempla admin) y quién es el dueño, para que el frontend pueda mostrar
  # "compartido por" sin otro request.
  rol: str
  owner_nombre: Optional[str] = None

class DispositivoCreateOut(BaseModel):
  dispositivo: DispositivoOut
  secret: str

class IntervaloUpdate(BaseModel):
  # None = automático (resetea a "usar el piso del plan vigente")
  intervalo_seg: Optional[int] = None