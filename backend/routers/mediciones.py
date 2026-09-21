from fastapi import APIRouter, Depends, BackgroundTasks
from services import medicion_service, alerta_service
from schemas.medicion import MedicionCreate, MedicionCreateResponse
from core.deps import get_dispositivo_autenticado

router = APIRouter()

@router.post("/", response_model=MedicionCreateResponse)
def create_medicion(
    payload: MedicionCreate,
    background_tasks: BackgroundTasks,
    dispositivo: dict = Depends(get_dispositivo_autenticado)
):
    respuesta, notificaciones = medicion_service.crear_medicion(
        payload.time, payload.mediciones, dispositivo["id"], dispositivo["rotacion_pendiente"],
        dispositivo["intervalo_configurado_seg"], dispositivo["first_connected_at"],
    )
    # Resend es HTTP bloqueante: el envío va después de responder al equipo,
    # no en el mismo request.
    if notificaciones:
        background_tasks.add_task(alerta_service.notificar_eventos, notificaciones)
    return respuesta
