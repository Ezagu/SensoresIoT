from fastapi import APIRouter, Request, Depends
from uuid import UUID
from schemas.acceso import AccesoDispositivoOut, AccesoDispositivoUpdate
from services import acceso_service
from core.deps import get_usuario_actual
from core.limiter import limiter

router = APIRouter()

@router.post("/{dispositivo_id}/vinculate")
@limiter.limit("5/10minutes")
def vinculate_dispositivo(request: Request, dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return acceso_service.crear_vinculacion_owner(usuario_actual["sub"], dispositivo_id)

@router.get("/{dispositivo_id}/accesos", response_model=list[AccesoDispositivoOut])
def get_access(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return acceso_service.obtener_accesos(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.patch("/{dispositivo_id}/accesos/{usuario_id}", response_model=AccesoDispositivoOut)
def change_access(dispositivo_id: UUID, usuario_id: UUID, data: AccesoDispositivoUpdate, usuario_actual: dict = Depends(get_usuario_actual)):
    return acceso_service.actualizar_rol(dispositivo_id, usuario_id, data.rol, usuario_actual["sub"], usuario_actual["rol"])

@router.delete("/{dispositivo_id}/accesos/{usuario_id}", status_code=204)
def delete_access(dispositivo_id: UUID, usuario_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    acceso_service.quitar_acceso(dispositivo_id, usuario_id, usuario_actual["sub"], usuario_actual["rol"])
