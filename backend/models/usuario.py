from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class UsuarioOut(BaseModel):
    id: UUID
    nombre: str
    email: str
    rol: str
    created_at: datetime

class UsuarioCreate(BaseModel):
    nombre: str
    email: str
    password: str
    confirm_password: str
    rol: Optional[str] = "user"