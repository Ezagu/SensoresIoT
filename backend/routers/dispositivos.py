from fastapi import APIRouter, Request
from uuid import UUID
from slowapi import Limiter
from slowapi.util import get_remote_address
from schemas.dispositivo import DispositivoCreate, DispositivoOut, DispositivoCreateOut, VinculationCreate
from schemas.sensor import SensorOut
from services import dispositivo_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.post("/", response_model=DispositivoCreateOut)
def create_dispositivo(dispositivo: DispositivoCreate):
    return dispositivo_service.crear_dispositivo(dispositivo)

@router.get("/{dispositivo_id}", response_model=DispositivoOut)
def get_dispositivo_by_id(dispositivo_id: UUID):
    return dispositivo_service.obtener_dispositivo(dispositivo_id)

@router.get("/{dispositivo_id}/sensores", response_model=list[SensorOut])
def get_sensores(dispositivo_id: UUID):
    return dispositivo_service.obtener_sensores(dispositivo_id)

@router.post("/{dispositivo_id}/regenerate-secret")
def regenerate_secret(dispositivo_id: UUID):
    return dispositivo_service.regenerar_secret_dispositivo(dispositivo_id)

@router.post("/{dispositivo_id}/vinculate")
@limiter.limit("5/10minutes")
def vinculate_dispositivo(request: Request, dispositivo_id: UUID, payload: VinculationCreate):
    rol = payload.rol or "owner"
    return dispositivo_service.crear_vinculacion(payload.usuario_id, dispositivo_id, rol)