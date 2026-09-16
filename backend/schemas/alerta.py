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

# Dos formas en una tabla, discriminadas por `tipo`: una transición de umbral
# trae valor/umbral/sensor, un corte de conectividad trae silencio_desde. Y
# alerta_id es opcional en las DOS: borrar una regla lo pone en NULL sin borrar
# el evento (ON DELETE SET NULL).
TipoEvento = Literal["disparada", "normalizada", "sin_reportar", "reconectado"]

class AlertaEventoOut(BaseModel):
  id: UUID
  dispositivo_id: UUID
  alerta_id: Optional[UUID]
  tipo: TipoEvento
  valor: Optional[float]
  medicion_at: datetime
  detectado_at: datetime
  tardio: bool
  destinatarios: int
  notificados: int

class AlertaEventosOut(BaseModel):
  eventos: list[AlertaEventoOut]
  siguiente_cursor: Optional[datetime] = None

class AlertaEventoConContextoOut(AlertaEventoOut):
  # El snapshot de la regla al momento del evento; en NULL para un corte.
  alerta_nombre: Optional[str]
  condicion: Optional[Condicion]
  umbral: Optional[float]
  tipo_sensor_nombre: Optional[str]
  tipo_sensor_unidad: Optional[str]
  # Sólo en un corte: desde cuándo dura el silencio.
  silencio_desde: Optional[datetime]
  # Vivo, del JOIN con dispositivos: el equipo es el mismo objeto físico y se
  # busca por el nombre que tiene hoy.
  dispositivo_nombre: str

class AlertaEventosConContextoOut(BaseModel):
  eventos: list[AlertaEventoConContextoOut]
  siguiente_cursor: Optional[datetime] = None
