import psycopg2.extras
from uuid import UUID
from fastapi import APIRouter, HTTPException
from schemas.usuario import UsuarioOut
from schemas.dispositivo import DispositivoOut
from db import get_connection

router = APIRouter()

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

@router.get("/{usuario_id}/dispositivos", response_model=list[DispositivoOut])
def get_dispositivos(usuario_id):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM dispositivos WHERE usuario_id = %s", (usuario_id,))
            return cur.fetchall()