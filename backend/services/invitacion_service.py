import math
import psycopg2.errors
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from repositories import invitacion_dispositivo_repo, acceso_repo, usuario_repo
from services import dispositivo_service, plan_service
from services.dispositivo_service import ROLES_ASIGNABLES
from core.security import generar_secret_urlsafe
from db import get_cursor

# Evita el arrepentimiento inmediato: regenerar mata en silencio el link que
# ya se repartió. No frena a un adversario (borrar + crear lo saltea a propósito).
COOLDOWN_REGENERAR = timedelta(minutes=5)

def crear_invitacion(dispositivo_id, usuario_id, rol, rol_dispositivo, email = None) -> dict:
    if rol_dispositivo not in ROLES_ASIGNABLES:
        raise HTTPException(422, f"No se puede asignar el rol {rol_dispositivo}")

    with get_cursor() as cur:
        dispositivo_service.validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        limites = plan_service.limites_de_usuario(cur, usuario_id)

        if not limites["puede_compartir"]:
            raise HTTPException(403, "Tu plan actual no permite compartir dispositivos")

        if email is None:
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        else:
            expires_at = datetime.now(timezone.utc) + timedelta(days=30)

        token, _ = generar_secret_urlsafe()

        invitacion = invitacion_dispositivo_repo.crear(cur, dispositivo_id, rol_dispositivo, token, expires_at, email)

        if invitacion is None:
            raise HTTPException(409, f"Ya existe un link activo para el rol {rol_dispositivo}, regeneralo o eliminalo")

        return invitacion

def obtener_invitaciones(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        dispositivo_service.validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return invitacion_dispositivo_repo.listar_por_dispositivo(cur, dispositivo_id)

def regenerar_invitacion(dispositivo_id, invitacion_id, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        dispositivo_service.validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        limites = plan_service.limites_de_usuario(cur, usuario_id)

        if not limites["puede_compartir"]:
            raise HTTPException(403, "Tu plan actual no permite compartir dispositivos")

        invitacion = invitacion_dispositivo_repo.buscar_por_id(cur, dispositivo_id, invitacion_id)

        if invitacion is None:
            raise HTTPException(404, f"No existe la invitación {invitacion_id}")

        # None = nunca regenerada: recién creada no tiene cooldown, sólo se lo
        # gana después de la primera regeneración.
        if invitacion["regenerado_at"] is not None:
            transcurrido = datetime.now(timezone.utc) - invitacion["regenerado_at"]
            if transcurrido < COOLDOWN_REGENERAR:
                restante = math.ceil((COOLDOWN_REGENERAR - transcurrido).total_seconds())
                raise HTTPException(429, f"Esperá {restante}s antes de regenerar de nuevo")

        if invitacion["email"] is None:
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        else:
            expires_at = datetime.now(timezone.utc) + timedelta(days=30)

        token, _ = generar_secret_urlsafe()

        return invitacion_dispositivo_repo.regenerar(cur, dispositivo_id, invitacion["id"], token, expires_at)

def eliminar_invitacion(dispositivo_id, invitacion_id, usuario_id, rol):
    with get_cursor() as cur:
        dispositivo_service.validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        if not invitacion_dispositivo_repo.eliminar(cur, dispositivo_id, invitacion_id):
            raise HTTPException(404, "invitación no existe o ya fue usada")

def aceptar_invitacion(dispositivo_id, token, usuario_id):
    with get_cursor() as cur:
        dispositivo_service.validar_que_exista_dispositivo(cur, dispositivo_id)

        limites = plan_service.limites_de_dispositivo(cur, dispositivo_id)
        if not limites["puede_compartir"]:
            raise HTTPException(403, "El dueño del dispositivo no tiene un plan que permita compartir su dispositivo")

        invitacion = invitacion_dispositivo_repo.buscar(cur, dispositivo_id, token)

        if invitacion is None:
            raise HTTPException(404, "invitación no existe o ya fue usada")

        if invitacion["expires_at"] is not None and invitacion["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(409, "invitación expirada")

        if invitacion["email"] is not None and invitacion["email"] != usuario_repo.buscar_email(cur, usuario_id):
            raise HTTPException(409, "invitación no corresponde al email de tu cuenta")

        try:
            acceso_repo.crear_vinculacion(cur, usuario_id, dispositivo_id, invitacion["rol"])

            if invitacion["email"] is not None:
                invitacion_dispositivo_repo.eliminar(cur, dispositivo_id, invitacion["id"])
        except psycopg2.errors.UniqueViolation:
            raise HTTPException(409, "ya tenés acceso a este dispositivo")  # condición de carrera
