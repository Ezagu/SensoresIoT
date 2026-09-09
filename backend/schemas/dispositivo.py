from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

class DispositivoCreate(BaseModel):
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None

class DispositivoUpdate(BaseModel):
  nombre: Optional[str] = None
  ubicacion: Optional[str] = None
  descripcion: Optional[str] = None
  activo: Optional[bool] = None

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

class AccesoDispositivoUpdate(BaseModel):
  rol: str

class AccesoDispositivoOut(BaseModel):
  usuario_id: UUID
  nombre: str
  email: str
  rol: str
  created_at: datetime

class LimitesDispositivoOut(BaseModel):
  # Los límites que rigen sobre ESTE dispositivo: salen del plan de su dueño, no
  # del de quien consulta (plan_service.limites_de_dispositivo). Sin esto el
  # frontend sólo conocía el plan del que mira, y un free con acceso compartido a
  # un equipo premium veía "las alertas son premium" mientras el backend le
  # aceptaba las reglas de ese equipo.
  # Van sólo los que el front necesita para no ofrecer lo que el backend va a
  # rechazar; el resto del plan del dueño no es asunto de quien mira.
  puede_alertas: bool
  # None = sin tope. Se cuenta por dispositivo, no por cuenta ni por sensor.
  max_alertas: Optional[int] = None
  # Piso de muestreo, no valor fijo: el dueño puede pedir un intervalo más lento.
  intervalo_minimo_seg: int

class DispositivoDetalleOut(DispositivoOut):
  # GET /dispositivos/{id}: acá sí hace falta resolver el rol (rol_en_dispositivo,
  # que contempla admin) y quién es el dueño, para que el frontend pueda mostrar
  # "compartido por" sin otro request.
  rol: str
  owner_nombre: Optional[str] = None
  limites: LimitesDispositivoOut

class DispositivoCreateOut(BaseModel):
  dispositivo: DispositivoOut
  secret: str

class IntervaloUpdate(BaseModel):
  # None = automático (resetea a "usar el piso del plan vigente")
  intervalo_seg: Optional[int] = None