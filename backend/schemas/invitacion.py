from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Literal
from datetime import datetime

class InvitacionCreate(BaseModel):
  rol: str
  email: Optional[str] = None

class InvitacionAccept(BaseModel):
  token: str

class InvitacionOut(BaseModel):
  id: UUID
  dispositivo_id: UUID
  rol: Literal["viewer", "editor"]
  email: Optional[str] = None
  token: str
  expires_at: datetime
  created_at: datetime
  regenerado_at: Optional[datetime] = None
