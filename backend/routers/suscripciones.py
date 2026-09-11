from fastapi import APIRouter, Depends
from uuid import UUID
from schemas.suscripcion import SuscripcionCreate, SuscripcionOut
from services import suscripcion_service
from core.deps import get_usuario_admin

router = APIRouter()

@router.post("/{usuario_id}/suscripcion", response_model=SuscripcionOut)
def asignar_suscripcion(usuario_id: UUID, suscripcion: SuscripcionCreate, usuario_admin = Depends(get_usuario_admin)):
    # Falla con 409 si el usuario ya tiene una vigente: hay que revocarla primero,
    # para no cortar sin querer un período ya pagado
    return suscripcion_service.asignar_plan(usuario_id, suscripcion.plan_id, suscripcion.fin_at)

@router.post("/{usuario_id}/suscripcion/revocar", response_model=SuscripcionOut)
def revocar_suscripcion(usuario_id: UUID, usuario_admin = Depends(get_usuario_admin)):
    # Corte inmediato. No borra la fila ni ningún dato del usuario: sólo la saca
    # del predicado de vigencia
    return suscripcion_service.revocar_plan(usuario_id)

@router.get("/{usuario_id}/suscripciones", response_model=list[SuscripcionOut])
def get_suscripciones(usuario_id: UUID, usuario_admin = Depends(get_usuario_admin)):
    return suscripcion_service.listar_suscripciones(usuario_id)
