import psycopg2.extras
import bcrypt
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from models.usuario import UsuarioCreate, UsuarioOut
from models.dispositivo import DispositivoOut
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

@router.post("/", response_model=UsuarioOut)
def create_usuario(usuario: UsuarioCreate):
    if(usuario.password != usuario.confirm_password):
        raise HTTPException(400, "Las contraseñas no coinciden")

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

@router.get("/{usuario_id}/dispositivos", response_model=list[DispositivoOut])
def get_dispositivos(usuario_id):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM dispositivos WHERE usuario_id = %s", (usuario_id,))
            return cur.fetchall()