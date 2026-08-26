from fastapi import APIRouter
from uuid import UUID
from datetime import datetime
from typing import Optional
from schemas.sensor import SensorCreate, SensorOut, TipoSensorOut
from schemas.medicion import DatosGraficoOut
from services import sensor_service

router = APIRouter()

@router.post("/", response_model=SensorOut)
def create_sensor(sensor: SensorCreate):
    return sensor_service.crear_sensor(sensor)

@router.get("/{sensor_id}", response_model=SensorOut)
def get_sensor_by_id(sensor_id: UUID):
    return sensor_service.obtener_sensor(sensor_id)

@router.get("/{sensor_id}/tipo-sensor", response_model=TipoSensorOut)
def get_tipo_sensor(sensor_id: UUID):
    return sensor_service.obtener_tipo_sensor(sensor_id)

@router.get("/{sensor_id}/mediciones/grafico", response_model=DatosGraficoOut)
def get_mediciones(
    sensor_id: UUID, 
    desde: Optional[datetime] = None, 
    hasta: Optional[datetime] = None,
):
    return sensor_service.obtener_grafico(sensor_id, desde, hasta)

