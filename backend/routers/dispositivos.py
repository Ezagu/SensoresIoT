from fastapi import APIRouter, Request, Depends
from uuid import UUID
from schemas.dispositivo import DispositivoCreate, DispositivoOut, DispositivoCreateOut, IntervaloUpdate
from schemas.sensor import SensorOut
from services import dispositivo_service
from core.deps import get_usuario_admin, get_usuario_actual, get_dispositivo_autenticado
from core.limiter import limiter

router = APIRouter()

@router.post("/rotate-secret")
@limiter.limit("10/hour")
def rotate_secret(request: Request, dispositivo: dict = Depends(get_dispositivo_autenticado)):
    # Rotación device-initiated: el dispositivo se autentica con su secret actual y
    # recibe el nuevo una única vez. El viejo sigue valiendo hasta que use el nuevo,
    # así una respuesta perdida no lo deja sin forma de reautenticarse.
    # Límite holgado a propósito: slowapi cuenta por IP y varios equipos comparten NAT.
    return dispositivo_service.rotar_secret_dispositivo(dispositivo["id"])

@router.post("/", response_model=DispositivoCreateOut)
def create_dispositivo(dispositivo: DispositivoCreate, usuario_admin: dict = Depends(get_usuario_admin)):
    return dispositivo_service.crear_dispositivo(dispositivo)

@router.get("/{dispositivo_id}", response_model=DispositivoOut)
def get_dispositivo_by_id(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.obtener_dispositivo(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.get("/{dispositivo_id}/sensores", response_model=list[SensorOut])
def get_sensores(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.obtener_sensores(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.post("/{dispositivo_id}/regenerate-secret")
def regenerate_secret(dispositivo_id: UUID, usuario_admin: dict = Depends(get_usuario_admin)):
    return dispositivo_service.regenerar_secret_dispositivo(dispositivo_id)

@router.post("/{dispositivo_id}/marcar-rotacion")
def marcar_rotacion(dispositivo_id: UUID, usuario_admin: dict = Depends(get_usuario_admin)):
    # Fuerza la rotación ante un secret filtrado: el flag viaja en la respuesta de la
    # próxima medición y el dispositivo rota solo, sin acceso físico
    return dispositivo_service.marcar_rotacion_pendiente(dispositivo_id)

@router.patch("/{dispositivo_id}/intervalo")
def set_intervalo(dispositivo_id: UUID, payload: IntervaloUpdate, usuario_actual: dict = Depends(get_usuario_actual)):
    # El piso del plan se valida acá; el dispositivo lo aplica solo con la
    # próxima respuesta a POST /mediciones/ (intervalo_sugerido)
    return dispositivo_service.configurar_intervalo(
        dispositivo_id, usuario_actual["sub"], usuario_actual["rol"], payload.intervalo_seg
    )

@router.post("/{dispositivo_id}/vinculate")
@limiter.limit("5/10minutes")
def vinculate_dispositivo(request: Request, dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.crear_vinculacion(usuario_actual["sub"], dispositivo_id, "owner")