import psycopg2.extras
import psycopg2.errors
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from db import get_connection
from repositories import usuario_repo, verificacion_repo, refresh_token_repo
from core.security import hash_password, generar_secret_urlsafe, hashear_sha256, verify_password, crear_access_token, REFRESH_TOKEN_EXPIRE_DAYS
from core.email import enviar_email_verificacion

def _crear_y_guardar_token(cur, user_id: str) -> str:
    verificacion_repo.eliminar_por_usuario(cur, user_id)
    token, token_hash = generar_secret_urlsafe()
    verificacion_repo.crear(cur, user_id, token_hash)
    return token

def register_usuario(usuario) -> dict:
    if usuario.password != usuario.confirm_password:
        raise HTTPException(422, "Las contraseñas no coinciden")

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            existing = usuario_repo.buscar_por_email(cur, usuario.email)

            if existing and existing["is_verified"]:
                raise HTTPException(409, "El email ya está registrado")

            if existing and not existing["is_verified"]:
                user_row = usuario_repo.buscar_por_id(cur, existing["id"])
            else:
                try:
                    password_hashed = hash_password(usuario.password)
                    user_row = usuario_repo.crear(cur, usuario.nombre, usuario.email, password_hashed)
                except psycopg2.errors.UniqueViolation:
                    #Condición de carrera
                    raise HTTPException(409, "El email ya está registrado")

            token = _crear_y_guardar_token(cur, user_row["id"])

    try:
        enviar_email_verificacion(to=usuario.email, token=token)
    except Exception as e:
        print(f"Error enviando mail de verificación a {usuario.email}: {e}")

    return user_row

def verificar_email(token: str) -> None:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            token_hash = hashear_sha256(token)
            verificacion = verificacion_repo.buscar_por_token_hash(cur, token_hash)

            if not verificacion:
                raise HTTPException(400, "Token inválido o ya utilizado")

            if verificacion["expires_at"] < datetime.now(timezone.utc):
                verificacion_repo.eliminar_por_token_hash(cur, token_hash)
                raise HTTPException(400, "El token expiró, solicitá uno nuevo")

            usuario_repo.marcar_verificado(cur, verificacion["usuario_id"])
            verificacion_repo.eliminar_por_token_hash(cur, token_hash)

def reenviar_verificacion(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            user = usuario_repo.buscar_por_email(cur, email)
            if not user or user["is_verified"]:
                return
            token = _crear_y_guardar_token(cur, user["id"])

    try:
        enviar_email_verificacion(to=email, token=token)
    except Exception as e:
        print(f"Error reenviando verificación a {email}: {e}")

def loguear(email: str, password: str):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            usuario = usuario_repo.buscar_por_email(cur, email)
            if usuario is None or not verify_password(password, usuario["password"]):
                raise HTTPException(401, "Usuario o contraseña incorrectos")

            access_token = crear_access_token(usuario["id"], usuario["rol"])
            refresh_token, refresh_token_hash = generar_secret_urlsafe()

            expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
            refresh_token_repo.crear(cur, usuario["id"], refresh_token_hash, expires_at)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token
    }