from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, Literal
from datetime import datetime

Condicion = Literal["mayor", "menor"]

class AlertaCreate(BaseModel):
  sensor_id: UUID
  nombre: Optional[str] = None
  condicion: Condicion
  umbral: float
  histeresis: float = 0
  # Lecturas seguidas que confirman la transición; 1 = dispara en la primera.
  muestras_confirmacion: int = Field(default=3, ge=1, le=8)

class AlertaUpdate(BaseModel):
  nombre: Optional[str] = None
  umbral: Optional[float] = None
  histeresis: Optional[float] = None
  activa: Optional[bool] = None
  muestras_confirmacion: Optional[int] = Field(default=None, ge=1, le=8)

class AlertaOut(BaseModel):
  id: UUID
  sensor_id: UUID
  creado_por: Optional[UUID]
  nombre: Optional[str]
  condicion: Condicion
  umbral: float
  histeresis: float
  muestras_confirmacion: int
  activa: bool
  estado: Literal["normal", "disparada"]
  estado_desde: Optional[datetime]
  ultimo_valor: Optional[float]
  ultima_evaluacion_at: Optional[datetime]
  ultima_notificacion_at: Optional[datetime]
  created_at: datetime

class AlertaEventoOut(BaseModel):
  id: UUID
  alerta_id: UUID
  tipo: Literal["disparada", "normalizada"]
  valor: float
  medicion_at: datetime
  detectado_at: datetime
  tardio: bool
  destinatarios: int
  notificados: int

class AlertaEventosOut(BaseModel):
  eventos: list[AlertaEventoOut]
  siguiente_cursor: Optional[datetime] = None

class AlertaEventoConContextoOut(AlertaEventoOut):
  alerta_nombre: Optional[str]
  condicion: Condicion
  umbral: float
  dispositivo_id: UUID
  dispositivo_nombre: str
  tipo_sensor_nombre: str
  tipo_sensor_unidad: str

class AlertaEventosConContextoOut(BaseModel):
  eventos: list[AlertaEventoConContextoOut]
  siguiente_cursor: Optional[datetime] = None
