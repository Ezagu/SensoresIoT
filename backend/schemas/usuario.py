from pydantic import BaseModel, Field
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
    # Mismas cotas que valida el front (frontend/src/lib/formularios.ts): la
    # validación del cliente es UX, esta es la que efectivamente rige.
    nombre: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)