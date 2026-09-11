from pydantic import BaseModel
from typing import Optional
from schemas.suscripcion import SuscripcionOut

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

class MiPlanOut(BaseModel):
  plan: PlanOut
  # None cuando el usuario es free: free es la ausencia de suscripción vigente
  suscripcion: Optional[SuscripcionOut] = None
