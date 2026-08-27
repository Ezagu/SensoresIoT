from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from services import usuario_service
from schemas.usuario import UsuarioOut
from schemas.dispositivo import DispositivoOut
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