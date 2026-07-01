import psycopg2.extras
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_connection

router = APIRouter()

class UsuarioOut(BaseModel):
    id: UUID
    nombre: str
    email: str
    rol: str
    created_at: datetime

@router.get("/", response_model=list[UsuarioOut])
def usuarios():
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, nombre, email, rol, created_at FROM usuarios")
            return cur.fetchall()

@router.get("/{usuario_id}", response_model=UsuarioOut)
def usuario(usuario_id: UUID):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, nombre, email, rol, created_at FROM usuarios WHERE id = %s", (usuario_id,))
            usuario = cur.fetchone()
            if usuario is None:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return usuario