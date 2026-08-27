from fastapi import APIRouter, Depends
from uuid import UUID
from datetime import datetime
from typing import Optional
from schemas.sensor import SensorCreate, SensorOut, SensorOutConTipo
from schemas.medicion import DatosGraficoOut
from services import sensor_service
from core.deps import get_usuario_admin, get_usuario_actual

router = APIRouter()

@router.post("/", response_model=SensorOut)
def create_sensor(
    sensor: SensorCreate, 
    usuario_admin = Depends(get_usuario_admin)
):
    return sensor_service.crear_sensor(sensor)

@router.get("/{sensor_id}", response_model=SensorOutConTipo)
def get_sensor_by_id(
    sensor_id: UUID, 
    usuario_actual = Depends(get_usuario_actual)
):
    return sensor_service.obtener_sensor(sensor_id, usuario_actual["sub"], usuario_actual["rol"])

@router.get("/{sensor_id}/mediciones/grafico", response_model=DatosGraficoOut)
def get_mediciones(
    sensor_id: UUID, 
    desde: Optional[datetime] = None, 
    hasta: Optional[datetime] = None,
    usuario_actual = Depends(get_usuario_actual)
):
    return sensor_service.obtener_grafico(sensor_id, desde, hasta, usuario_actual["sub"], usuario_actual["rol"])