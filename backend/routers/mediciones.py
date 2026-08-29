from fastapi import APIRouter, Depends
from services import medicion_service
from schemas.medicion import MedicionCreate
from core.deps import get_dispositivo_autenticado

router = APIRouter()

@router.post("/")
def create_medicion(payload: MedicionCreate, dispositivo: dict = Depends(get_dispositivo_autenticado)):
    return medicion_service.crear_medicion(
        payload.time, payload.mediciones, dispositivo["id"], dispositivo["rotacion_pendiente"]
    )
