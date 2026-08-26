from fastapi import APIRouter
from schemas.tipo_sensor import TipoSensorCreate, TipoSensorOut
from services import tipo_sensor_service

from db import get_connection

router = APIRouter()

@router.post("/", response_model=TipoSensorOut)
def create_tipo_sensor(tipo_sensor: TipoSensorCreate):
	return tipo_sensor_service.crear_tipo_sensor(tipo_sensor)

@router.get("/", response_model=list[TipoSensorOut])
def tipos_de_sensores():
    return tipo_sensor_service.listar_tipos_sensor()