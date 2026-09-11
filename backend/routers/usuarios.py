from fastapi import APIRouter, Depends
from uuid import UUID
from services import usuario_service, panel_service
from schemas.usuario import UsuarioOut
from schemas.dispositivo import DispositivoConRolOut
from schemas.panel import PanelOut
from core.deps import get_usuario_admin, get_usuario_propio_o_admin
from routers import suscripciones

router = APIRouter()
router.include_router(suscripciones.router)

@router.get("/", response_model=list[UsuarioOut])
def usuarios(usuario_admin = Depends(get_usuario_admin)):
    return usuario_service.listar_usuarios()

@router.get("/{usuario_id}", response_model=UsuarioOut)
def usuario(usuario_id: UUID, usuario_admin = Depends(get_usuario_admin)):
    return usuario_service.obtener_usuario(usuario_id)

@router.get("/{usuario_id}/dispositivos", response_model=list[DispositivoConRolOut])
def get_dispositivos(usuario_id: UUID, usuario_actual = Depends(get_usuario_propio_o_admin)):
    return usuario_service.obtener_dispositivos_de_usuario(usuario_id)

@router.get("/{usuario_id}/panel", response_model=PanelOut)
def get_panel(usuario_id: UUID, usuario_actual = Depends(get_usuario_propio_o_admin)):
    return panel_service.listar_panel(usuario_id)
