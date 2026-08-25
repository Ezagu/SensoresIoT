import bcrypt
import hashlib
import os
import secrets
import hashlib
import resend
import psycopg2.extras
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from models.usuario import UsuarioCreate, UsuarioOut
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from db import get_connection

router = APIRouter()

resend.api_key = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

limiter = Limiter(key_func=get_remote_address)

class VerifyRequest(BaseModel):
    token: str

class ResendVerifyRequest(BaseModel):
    email: str

def generate_verification_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash

def send_verification_email(to: str, token:str):
    verify_link = f"{FRONTEND_URL}/verify?token={token}"
    resend.Emails.send({
        "from": "onboarding@resend.dev",
        "to": [to],
        "subject": "Confirmá tu cuenta",
        "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Confirmá tu cuenta</h2>
                <p>Hacé click en el siguiente botón para verificar tu email:</p>
                <a href="{verify_link}"
                    style="display:inline-block; padding:12px 24px; background:#111;
                    color:#fff; text-decoration:none; border-radius:6px;"
                >
                    Verificar email
                </a>
                <p style="color:#666; font-size:13px; margin-top:24px;">
                    Este link expira en 24 horas. Si no creaste esta cuenta, ignorá este mail.
                </p>
            </div>
        """
    })

def crear_y_enviar_verificacion(cur, user_id: str, email: str):
    # Invalidar tokens previos de ese usuario
    cur.execute("DELETE FROM verificaciones_email WHERE usuario_id = %s", (user_id,))
    # Generar y guardar el nuevo token
    token, token_hash = generate_verification_token()
    cur.execute(
        """
        INSERT INTO verificaciones_email (usuario_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (user_id, token_hash, datetime.now(timezone.utc) + timedelta(hours=24))
    )
    return token

@router.post("/register", response_model=UsuarioOut)
def register(usuario: UsuarioCreate):
    if(usuario.password != usuario.confirm_password):
        raise HTTPException(409, "Las contraseñas no coinciden")

    password_hashed = bcrypt.hashpw(
        usuario.password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")
    
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Chequear si el email ya existe
            cur.execute("SELECT id, is_verified FROM usuarios WHERE email = %s", (usuario.email,))
            existing = cur.fetchone()

            if existing and existing["is_verified"]:
                raise HTTPException(409, "El email ya está registrado")

            if existing and not existing["is_verified"]:
                # usuario existe pero no verificó -> reusar, no duplicar
                user_id = existing["id"]
                cur.execute(
                    "SELECT id, nombre, email, rol, created_at, is_verified FROM usuarios WHERE id = %s",
                    (user_id,)
                )
                user_row = cur.fetchone()
            else:
                # Crear usuario nuevo
                cur.execute(
                    """
                    INSERT INTO usuarios (nombre, password, email, created_at)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, nombre, email, rol, created_at, is_verified
                    """,
                    (usuario.nombre, password_hashed, usuario.email, datetime.now(timezone.utc))
                )
                user_row = cur.fetchone()
                user_id = user_row["id"]
            token = crear_y_enviar_verificacion(cur, user_id, user_row["email"])
    try:
        send_verification_email(to=usuario.email, token=token)
    except Exception as e:
        print(f"Error enviando mail de verificación a {usuario.email}: {e}")

    return user_row

@router.post("/verify")
def verify_email(data: VerifyRequest):
    token_hash = hashlib.sha256(data.token.encode()).hexdigest()

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT usuario_id, expires_at FROM verificaciones_email WHERE token_hash = %s",
                (token_hash,)
            )
            verification = cur.fetchone()

            if not verification:
                raise HTTPException(400, "Token inválido o ya utilizado")

            if verification["expires_at"] < datetime.now(timezone.utc):
                cur.execute("DELETE FROM verificaciones_email WHERE token_hash = %s", (token_hash,))
                raise HTTPException(400, "El token expiró, solicitá uno nuevo")

            cur.execute(
                "UPDATE usuarios SET is_verified = true WHERE id = %s",
                (verification["usuario_id"],)
            )

            cur.execute(
                "DELETE FROM verificaciones_email WHERE token_hash = %s",
                (token_hash,)
            )
    return {"message": "Email verificado correctamente"}

@router.post("/resend-verify")
@limiter.limit("3/hour")
def resend_verify_email(request: Request, data: ResendVerifyRequest):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, is_verified FROM usuarios WHERE email = %s",
                (data.email,)
            )
            user = cur.fetchone()

            if not user or user["is_verified"]:
                return {"message": "Si el email existe y no fue verificado, te enviamos un nuevo link"}

            token = crear_y_enviar_verificacion(cur, user["id"], data.email)

    try:
        send_verification_email(to=data.email, token=token)
    except Exception as e:
        print(f"Error reenviando verificación a {data.email}: {e}")

    return {"message": "Si el email existe y no fue verificado, te enviamos un nuevo link"}