from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

class PlanOut(BaseModel):
  id: str
  nombre: str
  # None = ilimitado en dispositivos_incluidos, retencion_dias y max_alertas
  dispositivos_incluidos: Optional[int] = None
  retencion_dias: Optional[int] = None
  intervalo_minimo_seg: int
  puede_alertas: bool
  max_alertas: Optional[int] = None
  puede_compartir: bool
  puede_exportar: bool

class SuscripcionCreate(BaseModel):
  plan_id: str
  # None = sin vencimiento (plan asignado a mano, no vence solo)
  fin_at: Optional[datetime] = None

class SuscripcionOut(BaseModel):
  id: UUID
  usuario_id: UUID
  plan_id: str
  estado: str
  inicio_at: datetime
  fin_at: Optional[datetime] = None
  cancelada_at: Optional[datetime] = None
  origen: str

class MiPlanOut(BaseModel):
  plan: PlanOut
  # None cuando el usuario es free: free es la ausencia de suscripción vigente
  suscripcion: Optional[SuscripcionOut] = None
