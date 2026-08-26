from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class UsuarioOut(BaseModel):
    id: UUID
    nombre: str
    email: str
    rol: str
    created_at: datetime
    is_verified: bool

class UsuarioCreate(BaseModel):
    nombre: str
    email: str
    password: str
    confirm_password: str