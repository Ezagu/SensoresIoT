import psycopg2.errors
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from repositories import plan_repo, suscripcion_repo, usuario_repo
from core.tiempo import a_utc
from db import get_cursor

PLAN_FREE = "free"

# Fallback duro si no hay fila 'free' en el catálogo (base a medio migrar). Espeja
# la semilla de db/init.sql; los valores de verdad son los de la base.
LIMITES_FREE = {
    "id": PLAN_FREE,
    "nombre": "Free",
    "dispositivos_incluidos": None,
    "retencion_dias": 7,
    "intervalo_minimo_seg": 60,
    "puede_alertas": False,
    "max_alertas": 0,
    "puede_compartir": False,
    "puede_exportar": True,
}

MENSAJE_YA_TIENE = "El usuario ya tiene una suscripción vigente, revocala primero"

# --------------------------------------------------------------------------
# Punto único de consulta de límites: todo gate (retención, intervalo de
# muestreo, alertas, compartir, exportar) sale de acá, nada más toca
# planes/suscripciones. Reciben el cursor porque los gates corren dentro de
# transacciones ya abiertas (medicion_service.crear_medicion, por ejemplo).
# --------------------------------------------------------------------------

def _plan_free(cur) -> dict:
    return plan_repo.buscar_por_id(cur, PLAN_FREE) or LIMITES_FREE

def limites_de_usuario(cur, usuario_id) -> dict:
    # Límites de cuenta del titular: crear alertas propias, compartir sus dispositivos
    return suscripcion_repo.buscar_plan_vigente_por_usuario(cur, usuario_id) or _plan_free(cur)

def limites_de_dispositivo(cur, dispositivo_id) -> dict:
    # Salen del plan del owner del dispositivo, no del usuario que consulta: un
    # free con acceso compartido a un dispositivo premium ve lo mismo que el owner.
    return suscripcion_repo.buscar_plan_vigente_por_dispositivo(cur, dispositivo_id) or _plan_free(cur)

def intervalo_efectivo_seg(configurado, piso) -> int:
    # El valor elegido por el owner nunca baja del piso de su plan.
    return max(configurado, piso) if configurado is not None else piso

def ventana_de_consulta(cur, dispositivo_id, rol) -> dict:
    # piso = momento más antiguo consultable (None = sin límite), retencion_dias
    # = el valor del plan para que la respuesta explique el recorte. Admin exento:
    # es soporte viendo lo que un cliente reportó hace semanas, no un chequeo de
    # acceso (ese sigue siendo dispositivo_service.tiene_acceso_a_dispositivo).
    if rol == "admin":
        return {"piso": None, "retencion_dias": None}

    dias = limites_de_dispositivo(cur, dispositivo_id)["retencion_dias"]
    piso = None if dias is None else datetime.now(timezone.utc) - timedelta(days=dias)
    return {"piso": piso, "retencion_dias": dias}

# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

def listar_planes() -> list[dict]:
    with get_cursor() as cur:
        return plan_repo.listar_activos(cur)

def obtener_mi_plan(usuario_id) -> dict:
    with get_cursor() as cur:
        return {
            "plan": limites_de_usuario(cur, usuario_id),
            "suscripcion": suscripcion_repo.buscar_vigente(cur, usuario_id),
        }

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
