from fastapi import APIRouter
from services import medicion_service
from schemas.medicion import MedicionCreate

router = APIRouter()

@router.post("/medicion")
def create_medicion(payload: MedicionCreate):
    return medicion_service.crear_medicion(payload)