from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime

class SensorResumenOut(BaseModel):
    id: UUID
    tipo_sensor_id: int
    tipo_nombre: str
    unidad: str
    ultimo_valor: Optional[float] = None
    ultimo_at: Optional[datetime] = None
    disparada: bool

class DispositivoResumenOut(BaseModel):
    id: UUID
    nombre: Optional[str] = None
    ubicacion: Optional[str] = None
    descripcion: Optional[str] = None
    activo: bool
    last_seen_at: Optional[datetime]
    first_connected_at: Optional[datetime]
    intervalo_configurado_seg: Optional[int] = None
    rol: str
    # Resuelto con el plan del DUEÑO del dispositivo, a diferencia de
    # intervalo_configurado_seg (que es sólo el valor elegido, sin el piso del plan).
    intervalo_efectivo_seg: int
    online: bool
    alertas_disparadas: int
    sensores: list[SensorResumenOut]

class PanelOut(BaseModel):
    dispositivos: list[DispositivoResumenOut]
