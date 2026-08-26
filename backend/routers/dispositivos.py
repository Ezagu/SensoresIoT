from fastapi import APIRouter
from uuid import UUID
from schemas.dispositivo import DispositivoCreate, DispositivoOut, DispositivoCreateOut
from schemas.sensor import SensorOut
from services import dispositivo_service

router = APIRouter()

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