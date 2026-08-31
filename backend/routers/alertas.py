from fastapi import APIRouter, Depends
from uuid import UUID
from datetime import datetime
from typing import Optional
from schemas.alerta import (
    AlertaCreate, AlertaUpdate, AlertaOut, AlertaEventosOut,
    AlertaEventosConContextoOut, PreferenciaUpdate,
)
from services import alerta_service
from core.deps import get_usuario_actual

router = APIRouter()

@router.post("/", response_model=AlertaOut)
def create_alerta(alerta: AlertaCreate, usuario_actual = Depends(get_usuario_actual)):
    return alerta_service.crear_alerta(alerta, usuario_actual["sub"], usuario_actual["rol"])

# Tiene que ir ANTES de "/{alerta_id}": FastAPI matchea por orden y si no,
# "eventos" entra como alerta_id y devuelve 422.
@router.get("/eventos", response_model=AlertaEventosConContextoOut)
def get_eventos_globales(
    hasta: Optional[datetime] = None,
    cursor: Optional[datetime] = None,
    limite: Optional[int] = 50,
    usuario_actual = Depends(get_usuario_actual)
):
    # Log: eventos de alertas de todos los dispositivos del usuario.
    return alerta_service.eventos_globales(usuario_actual["sub"], hasta, cursor, limite)

@router.get("/{alerta_id}", response_model=AlertaOut)
def get_alerta(alerta_id: UUID, usuario_actual = Depends(get_usuario_actual)):
    return alerta_service.obtener_alerta(alerta_id, usuario_actual["sub"], usuario_actual["rol"])

@router.patch("/{alerta_id}", response_model=AlertaOut)
def update_alerta(alerta_id: UUID, cambios: AlertaUpdate, usuario_actual = Depends(get_usuario_actual)):
    return alerta_service.actualizar_alerta(alerta_id, usuario_actual["sub"], usuario_actual["rol"], cambios)

@router.delete("/{alerta_id}")
def delete_alerta(alerta_id: UUID, usuario_actual = Depends(get_usuario_actual)):
    alerta_service.eliminar_alerta(alerta_id, usuario_actual["sub"], usuario_actual["rol"])
    return {"detail": "Alerta eliminada"}

@router.put("/{alerta_id}/notificacion")
def update_preferencia(alerta_id: UUID, cambios: PreferenciaUpdate, usuario_actual = Depends(get_usuario_actual)):
    # Preferencia propia: cualquiera con acceso al dispositivo (viewer incluido)
    # decide si quiere sus propios mails de esta alerta.
    return alerta_service.actualizar_preferencia(alerta_id, usuario_actual["sub"], usuario_actual["rol"], cambios.notificar)

@router.get("/{alerta_id}/eventos", response_model=AlertaEventosOut)
def get_eventos(
    alerta_id: UUID,
    hasta: Optional[datetime] = None,
    cursor: Optional[datetime] = None,
    limite: Optional[int] = 50,
    usuario_actual = Depends(get_usuario_actual)
):
    return alerta_service.obtener_eventos(alerta_id, usuario_actual["sub"], usuario_actual["rol"], hasta, cursor, limite)
