from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from services import usuario_service, plan_service
from schemas.usuario import UsuarioOut
from schemas.dispositivo import DispositivoOut
from schemas.plan import SuscripcionCreate, SuscripcionOut
from core.deps import get_usuario_admin, get_usuario_actual

router = APIRouter()

@router.get("/", response_model=list[UsuarioOut])
def usuarios(usuario_admin = Depends(get_usuario_admin)):
    return usuario_service.listar_usuarios()

@router.get("/{usuario_id}", response_model=UsuarioOut)
def usuario(usuario_id: UUID, usuario_admin = Depends(get_usuario_admin)):
    return usuario_service.obtener_usuario(usuario_id)

@router.get("/{usuario_id}/dispositivos", response_model=list[DispositivoOut])
def get_dispositivos(usuario_id: UUID, usuario_actual = Depends(get_usuario_actual)):
    if usuario_id != usuario_actual["sub"] and usuario_actual["rol"] != "admin":
        raise HTTPException(403, "No tienes acceso a este recurso")
    return usuario_service.obtener_dispositivos_de_usuario(usuario_id)

@router.post("/{usuario_id}/suscripcion", response_model=SuscripcionOut)
def asignar_suscripcion(usuario_id: UUID, suscripcion: SuscripcionCreate, usuario_admin = Depends(get_usuario_admin)):
    # Falla con 409 si el usuario ya tiene una vigente: hay que revocarla primero,
    # para no cortar sin querer un período ya pagado
    return plan_service.asignar_plan(usuario_id, suscripcion.plan_id, suscripcion.fin_at)

@router.post("/{usuario_id}/suscripcion/revocar", response_model=SuscripcionOut)
def revocar_suscripcion(usuario_id: UUID, usuario_admin = Depends(get_usuario_admin)):
    # Corte inmediato. No borra la fila ni ningún dato del usuario: sólo la saca
    # del predicado de vigencia
    return plan_service.revocar_plan(usuario_id)

@router.get("/{usuario_id}/suscripciones", response_model=list[SuscripcionOut])
def get_suscripciones(usuario_id: UUID, usuario_admin = Depends(get_usuario_admin)):
    return plan_service.listar_suscripciones(usuario_id)
