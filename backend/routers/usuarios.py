import psycopg2.extras
import bcrypt
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional


from db import get_connection

router = APIRouter()

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
    rol: Optional[str] = "viewer"

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
                raise HTTPException(404, "Usuario no encontrado")
            return usuario

@router.post("/", response_model=UsuarioOut)
def create_usuario(usuario: UsuarioCreate):
    password_hashed = bcrypt.hashpw(
        usuario.password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")
    
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO usuarios (nombre, password, email, rol, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, nombre, email, rol, created_at
                    """, 
                    (usuario.nombre, password_hashed, usuario.email, usuario.rol, datetime.now(timezone.utc))
                )
                return cur.fetchone()
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(409, "El email ya está registrado")