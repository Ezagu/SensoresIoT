from fastapi import APIRouter
from uuid import UUID
from services import usuario_service
from schemas.usuario import UsuarioOut
from schemas.dispositivo import DispositivoOut

router = APIRouter()

@router.get("/", response_model=list[UsuarioOut])
def usuarios():
    return usuario_service.listar_usuarios()

@router.get("/{usuario_id}", response_model=UsuarioOut)
def usuario(usuario_id: UUID):
    return usuario_service.obtener_usuario(usuario_id)

@router.get("/{usuario_id}/dispositivos", response_model=list[DispositivoOut])
def get_dispositivos(usuario_id: UUID):
    return usuario_service.obtener_dispositivos_de_usuario(usuario_id)