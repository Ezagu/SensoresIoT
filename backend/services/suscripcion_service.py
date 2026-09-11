import psycopg2.errors
from datetime import datetime, timezone
from fastapi import HTTPException
from repositories import plan_repo, suscripcion_repo, usuario_repo
from core.tiempo import a_utc
from db import get_cursor

MENSAJE_YA_TIENE = "El usuario ya tiene una suscripción vigente, revocala primero"

def asignar_plan(usuario_id, plan_id, fin_at) -> dict:
    fin_at = a_utc(fin_at)
    if fin_at is not None and fin_at <= datetime.now(timezone.utc):
        raise HTTPException(400, "fin_at tiene que ser posterior a ahora")

    with get_cursor() as cur:
        if usuario_repo.buscar_por_id(cur, usuario_id) is None:
            raise HTTPException(404, "Usuario no encontrado")

        if plan_repo.buscar_por_id(cur, plan_id) is None:
            raise HTTPException(404, "El plan no existe")

        if suscripcion_repo.buscar_vigente(cur, usuario_id) is not None:
            raise HTTPException(409, MENSAJE_YA_TIENE)

        try:
            return suscripcion_repo.crear(cur, usuario_id, plan_id, fin_at, "admin")
        except psycopg2.errors.ExclusionViolation:
            # Dos requests concurrentes pasan el chequeo de arriba (check-then-act);
            # el constraint de no solapamiento corta a la que llega segunda.
            raise HTTPException(409, MENSAJE_YA_TIENE)

def revocar_plan(usuario_id) -> dict:
    with get_cursor() as cur:
        suscripcion = suscripcion_repo.revocar_vigente(cur, usuario_id)
        if suscripcion is None:
            cur.connection.commit()  # si no, el raise hace rollback del revocar_vigente
            raise HTTPException(404, "El usuario no tiene una suscripción vigente")
        return suscripcion

def listar_suscripciones(usuario_id) -> list[dict]:
    with get_cursor() as cur:
        return suscripcion_repo.listar_por_usuario(cur, usuario_id)
