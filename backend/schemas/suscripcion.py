from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

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
