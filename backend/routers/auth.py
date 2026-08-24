import bcrypt
import psycopg2.extras
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta
from models.usuario import UsuarioCreate, UsuarioOut
from db import get_connection
from utils import generate_verification_token, send_verification_email

router = APIRouter()

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

    try:
        send_verification_email(to=usuario.email, token=token)
    except Exception as e:
        print(f"Error enviando mail de verificación a {usuario.email}: {e}")

    return user_row