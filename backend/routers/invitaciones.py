from fastapi import APIRouter, Depends
from uuid import UUID
from schemas.invitacion import InvitacionCreate, InvitacionOut, InvitacionAccept
from services import invitacion_service
from core.deps import get_usuario_actual

router = APIRouter()

@router.post("/{dispositivo_id}/invitaciones", response_model=InvitacionOut)
def create_invitation(dispositivo_id: UUID, invitacion: InvitacionCreate, usuario_actual: dict = Depends(get_usuario_actual)):
    return invitacion_service.crear_invitacion(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"], invitacion.rol, invitacion.email)

@router.post("/{dispositivo_id}/invitaciones/{invitacion_id}/regenerate", response_model=InvitacionOut)
def regenerate_invitation(dispositivo_id: UUID, invitacion_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return invitacion_service.regenerar_invitacion(dispositivo_id, invitacion_id, usuario_actual["sub"], usuario_actual["rol"])

@router.get("/{dispositivo_id}/invitaciones", response_model=list[InvitacionOut])
def get_invitations(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return invitacion_service.obtener_invitaciones(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.delete("/{dispositivo_id}/invitaciones/{invitacion_id}", status_code=204)
def delete_invitation(dispositivo_id: UUID, invitacion_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    invitacion_service.eliminar_invitacion(dispositivo_id, invitacion_id, usuario_actual["sub"], usuario_actual["rol"])

@router.post("/{dispositivo_id}/invitaciones/accept", status_code=201)
def accept_invitation(dispositivo_id: UUID, invitacion: InvitacionAccept, usuario_actual: dict = Depends(get_usuario_actual)):
    invitacion_service.aceptar_invitacion(dispositivo_id, invitacion.token, usuario_actual["sub"])
