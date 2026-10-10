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
    if payload.diag:
        print(f"[Diagnóstico {dispositivo['id']}] mediciones={len(payload.mediciones)}; diag={payload.diag}")

    respuesta, notificaciones = medicion_service.crear_medicion(payload.mediciones, dispositivo, payload.bateria_mv)

    # Resend es HTTP bloqueante: el envío va después de responder al equipo, no en el mismo request.
    if notificaciones:
        background_tasks.add_task(alerta_service.notificar_eventos, notificaciones)

    return respuesta
