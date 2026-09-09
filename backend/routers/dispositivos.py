from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
from uuid import UUID
from datetime import datetime
from typing import Optional
from schemas.dispositivo import DispositivoCreate, DispositivoDetalleOut, DispositivoCreateOut, IntervaloUpdate, DispositivoUpdate, AccesoDispositivoOut, AccesoDispositivoUpdate
from schemas.sensor import SensorOut
from schemas.alerta import AlertaConNotificarOut, AlertaEventosConContextoOut
from services import dispositivo_service, exportacion_service, alerta_service
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

@router.get("/{dispositivo_id}", response_model=DispositivoDetalleOut)
def get_dispositivo_by_id(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.obtener_dispositivo(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.patch("/{dispositivo_id}", response_model=DispositivoDetalleOut)
def update_dispositivo(dispositivo_id: UUID, datos: DispositivoUpdate, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.actualizar_datos(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"], datos)

@router.get("/{dispositivo_id}/sensores", response_model=list[SensorOut])
def get_sensores(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.obtener_sensores(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.get("/{dispositivo_id}/alertas", response_model=list[AlertaConNotificarOut])
def get_alertas(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return alerta_service.listar_por_dispositivo(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.get("/{dispositivo_id}/alertas/eventos", response_model=AlertaEventosConContextoOut)
def get_alertas_eventos(
    dispositivo_id: UUID,
    hasta: Optional[datetime] = None,
    cursor: Optional[datetime] = None,
    limite: Optional[int] = 50,
    usuario_actual: dict = Depends(get_usuario_actual)
):
    # Historial de todas las alertas del equipo, no de una sola.
    return alerta_service.eventos_por_dispositivo(
        dispositivo_id, usuario_actual["sub"], usuario_actual["rol"], hasta, cursor, limite
    )

@router.get("/{dispositivo_id}/exportar")
@limiter.limit("20/hour")
def exportar_historial(
    request: Request,
    dispositivo_id: UUID,
    desde: Optional[datetime] = None,
    hasta: Optional[datetime] = None,
    intervalo_seg: Optional[int] = None,
    excel: bool = False,
    usuario_actual: dict = Depends(get_usuario_actual)
):
    # Sin tope de plan: exportar no es premium, lo único que lo limita es la
    # misma ventana de retención que ya recorta /grafico y /historial.
    #
    # Sin `desde` se exporta el historial completo del dispositivo; sin
    # `intervalo_seg` se exporta cada medición guardada, sin agregar.
    export = exportacion_service.preparar_export_dispositivo(
        dispositivo_id, desde, hasta, usuario_actual["sub"], usuario_actual["rol"], excel, intervalo_seg
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{export["nombre_archivo"]}"',
        "X-Resolucion": export["resolucion"],
        "X-Fuente": export["fuente"],
        "X-Desde-Efectivo": export["desde_efectivo"].isoformat(),
        "X-Recortado": str(export["recortado"]).lower(),
    }
    # Los opcionales se omiten en vez de mandarse vacíos: retencion_dias None =
    # plan sin límite, intervalo_seg None = export sin agregar.
    if export["retencion_dias"] is not None:
        headers["X-Retencion-Dias"] = str(export["retencion_dias"])
    if export["intervalo_seg"] is not None:
        headers["X-Intervalo-Seg"] = str(export["intervalo_seg"])

    return StreamingResponse(
        export["filas"],
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )

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
    return dispositivo_service.crear_vinculacion_owner(usuario_actual["sub"], dispositivo_id)

@router.get("/{dispositivo_id}/accesos", response_model=list[AccesoDispositivoOut])
def get_access(dispositivo_id: UUID, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.obtener_accesos(dispositivo_id, usuario_actual["sub"], usuario_actual["rol"])

@router.patch("/{dispositivo_id}/accesos/{usuario_id}", response_model=AccesoDispositivoOut)
def change_access(dispositivo_id: UUID, usuario_id: UUID, data: AccesoDispositivoUpdate, usuario_actual: dict = Depends(get_usuario_actual)):
    return dispositivo_service.actualizar_rol(dispositivo_id, usuario_id, data.rol, usuario_actual["sub"], usuario_actual["rol"])