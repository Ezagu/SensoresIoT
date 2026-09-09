import psycopg2.errors
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from db import get_cursor
from repositories import usuario_repo, verificacion_repo, refresh_token_repo
from core.security import hash_password, generar_secret_urlsafe, hashear_sha256, verify_password, crear_access_token, REFRESH_TOKEN_EXPIRE_DAYS
from core.email import enviar_email_verificacion

def _crear_y_guardar_token_verificacion(cur, user_id: str) -> str:
    verificacion_repo.eliminar_por_usuario(cur, user_id)
    token, token_hash = generar_secret_urlsafe()
    verificacion_repo.crear(cur, user_id, token_hash)
    return token

def _crear_tokens_login(cur, usuario_id, usuario_rol):
    access_token = crear_access_token(usuario_id, usuario_rol)
    refresh_token, refresh_token_hash = generar_secret_urlsafe()

    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token_repo.crear(cur, usuario_id, refresh_token_hash, expires_at)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token
    }

def register_usuario(usuario) -> dict:
    with get_cursor() as cur:
        existing = usuario_repo.buscar_por_email(cur, usuario.email)

        if existing:
            user_row = usuario_repo.buscar_por_id(cur, existing["id"])
            if existing["is_verified"]:
                return user_row
        else:
            try:
                password_hashed = hash_password(usuario.password)
                user_row = usuario_repo.crear(cur, usuario.nombre, usuario.email, password_hashed)
            except psycopg2.errors.UniqueViolation:
                raise HTTPException(409, "El email ya está registrado")  # condición de carrera

        token = _crear_y_guardar_token_verificacion(cur, user_row["id"])

    try:
        enviar_email_verificacion(to=usuario.email, token=token)
    except Exception as e:
        print(f"Error enviando mail de verificación a {usuario.email}: {e}")

    return user_row

def verificar_email(token: str) -> None:
    with get_cursor() as cur:
        token_hash = hashear_sha256(token)
        verificacion = verificacion_repo.buscar_por_token_hash(cur, token_hash)

        if not verificacion:
            raise HTTPException(400, "Token inválido o ya utilizado")

        if verificacion["expires_at"] < datetime.now(timezone.utc):
            verificacion_repo.eliminar_por_token_hash(cur, token_hash)
            cur.connection.commit()  # si no, el raise hace rollback y el token queda vivo
            raise HTTPException(400, "El token expiró, solicitá uno nuevo")

        usuario_repo.marcar_verificado(cur, verificacion["usuario_id"])
        verificacion_repo.eliminar_por_token_hash(cur, token_hash)

def reenviar_verificacion(email: str) -> None:
    with get_cursor() as cur:
        user = usuario_repo.buscar_por_email(cur, email)
        if not user or user["is_verified"]:
            return
        token = _crear_y_guardar_token_verificacion(cur, user["id"])

    try:
        enviar_email_verificacion(to=email, token=token)
    except Exception as e:
        print(f"Error reenviando verificación a {email}: {e}")

def loguear(email: str, password: str):
    with get_cursor() as cur:
        usuario = usuario_repo.buscar_por_email(cur, email)

        if usuario is None:
            raise HTTPException(401, "Usuario o contraseña incorrectos")

        if usuario["bloqueado_hasta"] and usuario["bloqueado_hasta"] > datetime.now(timezone.utc):
            raise HTTPException(401, "cuenta bloqueada temporalmente, reintentá más tarde")

        if not verify_password(password, usuario["password"]):
            nuevos_intentos = usuario["intentos_fallidos"] + 1
            bloqueado_hasta = None
            if nuevos_intentos >= 5:
                bloqueado_hasta = datetime.now(timezone.utc) + timedelta(minutes=15)
                nuevos_intentos = 0

            usuario_repo.actualizar_intentos_fallidos(cur, usuario["id"], nuevos_intentos, bloqueado_hasta)
            cur.connection.commit()  # si no, el raise hace rollback y el contador no avanza
            raise HTTPException(401, "Usuario o contraseña incorrectos")

        if not usuario["is_verified"]:
            raise HTTPException(403, "Tenés que verificar tu email antes de iniciar sesión")

        if usuario["intentos_fallidos"] > 0 or usuario["bloqueado_hasta"]:
            usuario_repo.actualizar_intentos_fallidos(cur, usuario["id"], 0, None)

        tokens = _crear_tokens_login(cur, usuario["id"], usuario["rol"])

    return tokens

def obtener_sesion(usuario_id, rol) -> dict:
    with get_cursor() as cur:
        usuario = usuario_repo.buscar_por_id(cur, usuario_id)
        if usuario is None:
            raise HTTPException(401, "Sesión inválida, iniciá sesión de nuevo")

    # El rol sale del token y no de la fila: es el que rige en las dependencias
    # de autorización hasta que el access token expire, así que devolver otro
    # haría que la UI y los permisos reales no coincidan.
    return {
        "usuario_id": usuario["id"],
        "nombre": usuario["nombre"],
        "email": usuario["email"],
        "rol": rol,
    }

def refrescar_sesion(refresh_token):
    with get_cursor() as cur:
        token_hash = hashear_sha256(refresh_token)
        registro = refresh_token_repo.buscar_por_token_hash(cur, token_hash)

        if registro is None or registro["revocado"] or registro["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(401, "Sesión inválida, iniciá sesión de nuevo")

        refresh_token_repo.revocar_token(cur, registro["id"])

        usuario = usuario_repo.buscar_por_id(cur, registro["usuario_id"])
        tokens = _crear_tokens_login(cur, usuario["id"], usuario["rol"])
    return tokens

def cerrar_sesion(refresh_token):
    with get_cursor() as cur:
        token_hash = hashear_sha256(refresh_token)
        registro = refresh_token_repo.buscar_por_token_hash(cur, token_hash)
        if registro is not None and not registro["revocado"]:
            refresh_token_repo.revocar_token(cur, registro["id"])

def cerrar_sesion_global(usuario_id):
    with get_cursor() as cur:
        refresh_token_repo.revocar_todos_los_tokens(cur, usuario_id)
    return {"status": "ok"}
