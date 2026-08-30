import psycopg2.errors
import psycopg2.extras
from datetime import datetime, timezone
from fastapi import HTTPException
from repositories import plan_repo, suscripcion_repo, usuario_repo
from db import get_connection

PLAN_FREE = "free"

# Fallback duro: si no hay suscripción vigente se busca la fila 'free' del catálogo,
# y si esa fila tampoco está (base a medio migrar) se devuelve esto. Falla cerrada,
# ante cualquier estado indeterminado el plan efectivo es free y nunca premium.
# Espeja la semilla de db/init.sql; los valores de verdad son los de la base, esto
# es sólo el piso para que nadie quede sin límites.
LIMITES_FREE = {
    "id": PLAN_FREE,
    "nombre": "Free",
    "dispositivos_incluidos": None,
    "retencion_dias": 7,
    "intervalo_minimo_seg": 60,
    "puede_alertas": False,
    "max_alertas": 0,
    "puede_compartir": False,
    "puede_exportar": False,
}

MENSAJE_YA_TIENE = "El usuario ya tiene una suscripción vigente, revocala primero"

# --------------------------------------------------------------------------
# Punto único de consulta de límites
#
# Todo gate (retención de historial, intervalo de muestreo, alertas, compartir,
# exportar) sale de acá y de ningún otro lado. Ningún servicio consulta planes ni
# suscripciones por su cuenta.
#
# Reciben el cursor en vez de abrir conexión porque los gates corren dentro de
# transacciones ya abiertas (medicion_service.crear_medicion, por ejemplo).
#
# Devuelven la fila de `planes` tal cual: la fila ES el objeto de límites, así
# sumar una columna al catálogo no obliga a tocar este módulo.
#
# La falla cerrada aplica a datos indeterminados, no a errores de base: envolver
# esto en un try/except para devolver free ante una excepción de psycopg2 sería
# inútil, porque después de un error la transacción queda abortada y toda query
# posterior sobre ese cursor falla igual. Un error real propaga y el request
# termina en 500, que tampoco sirve nada premium.
# --------------------------------------------------------------------------

def _plan_free(cur) -> dict:
    return plan_repo.buscar_por_id(cur, PLAN_FREE) or LIMITES_FREE

def limites_de_usuario(cur, usuario_id) -> dict:
    # Límites de cuenta del titular: crear alertas propias, compartir sus dispositivos
    return suscripcion_repo.buscar_plan_vigente_por_usuario(cur, usuario_id) or _plan_free(cur)

def limites_de_dispositivo(cur, dispositivo_id) -> dict:
    # Límites de los datos de un dispositivo: salen del plan de su owner, no del
    # usuario que consulta. Un free con acceso compartido a un dispositivo de un
    # owner premium ve todo lo que ve el owner.
    return suscripcion_repo.buscar_plan_vigente_por_dispositivo(cur, dispositivo_id) or _plan_free(cur)

# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

def listar_planes() -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return plan_repo.listar_activos(cur)

def obtener_mi_plan(usuario_id) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return {
                "plan": limites_de_usuario(cur, usuario_id),
                "suscripcion": suscripcion_repo.buscar_vigente(cur, usuario_id),
            }

def asignar_plan(usuario_id, plan_id, fin_at) -> dict:
    # Toda validación que pueda levantar HTTPException va antes del INSERT: el
    # context manager de get_connection hace rollback ante cualquier Exception,
    # HTTPException incluida, así que un write seguido de un raise se pierde.
    if fin_at is not None:
        if fin_at.tzinfo is None:
            fin_at = fin_at.replace(tzinfo=timezone.utc)
        if fin_at <= datetime.now(timezone.utc):
            raise HTTPException(400, "fin_at tiene que ser posterior a ahora")

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if usuario_repo.buscar_por_id(cur, usuario_id) is None:
                raise HTTPException(404, "Usuario no encontrado")

            if plan_repo.buscar_por_id(cur, plan_id) is None:
                raise HTTPException(404, "El plan no existe")

            if suscripcion_repo.buscar_vigente(cur, usuario_id) is not None:
                raise HTTPException(409, MENSAJE_YA_TIENE)

            try:
                return suscripcion_repo.crear(cur, usuario_id, plan_id, fin_at, "admin")
            except psycopg2.errors.ExclusionViolation:
                # El chequeo de arriba es check-then-act: dos requests concurrentes lo
                # pasan los dos y quedarían dos suscripciones vigentes a la vez. El
                # constraint de no solapamiento corta a la perdedora. La transacción ya
                # está abortada acá, no se puede hacer nada más que levantar el error.
                raise HTTPException(409, MENSAJE_YA_TIENE)

def revocar_plan(usuario_id) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            suscripcion = suscripcion_repo.revocar_vigente(cur, usuario_id)
            if suscripcion is None:
                # El commit explícito antes del raise es obligatorio: get_connection
                # hace rollback ante HTTPException, así que sin esto cualquier write
                # anterior del bloque se perdería en silencio.
                conn.commit()
                raise HTTPException(404, "El usuario no tiene una suscripción vigente")
            return suscripcion

def listar_suscripciones(usuario_id) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return suscripcion_repo.listar_por_usuario(cur, usuario_id)
