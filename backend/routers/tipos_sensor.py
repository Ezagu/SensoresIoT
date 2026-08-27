from fastapi import APIRouter, Depends
from schemas.tipo_sensor import TipoSensorCreate, TipoSensorOut
from services import tipo_sensor_service
from core.deps import get_usuario_admin, get_usuario_actual

router = APIRouter()

@router.post("/", response_model=TipoSensorOut)
def create_tipo_sensor(tipo_sensor: TipoSensorCreate, usuario_admin = Depends(get_usuario_admin)):
	return tipo_sensor_service.crear_tipo_sensor(tipo_sensor)

@router.get("/", response_model=list[TipoSensorOut])
def tipos_de_sensores(get_usuario_actual = Depends(get_usuario_actual)):
    return tipo_sensor_service.listar_tipos_sensor()