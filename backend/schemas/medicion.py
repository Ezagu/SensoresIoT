from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Medicion(BaseModel):
    sensor_id: UUID
    value: float
    time: Optional[datetime] = None

class Umbral(BaseModel):
    sensor_id: str
    condicion: str
    umbral: float
    histeresis: float
    muestras: int

class MedicionCreate(BaseModel):
    time: Optional[datetime] = None
    mediciones: list[Medicion]

class MedicionCreateResponse(BaseModel):
    status: str
    aceptadas: int
    duplicadas: int
    rechazadas_por_intervalo: list[str]
    server_epoch: int
    intervalo_sugerido_seg: int
    intervalo_contacto_seg: int
    umbrales: list[Umbral]
    rotar_secret: bool

class MedicionOut(BaseModel):
    value: float
    time: datetime

class ResumenOut(BaseModel):
    promedio: float | None
    minimo: float | None
    maximo: float | None

class MedicionAgregadaOut(BaseModel):
    bucket: datetime
    promedio: float
    minimo: float
    maximo: float

class DatosGraficoOut(BaseModel):
    puntos: list[MedicionAgregadaOut]
    resumen: ResumenOut
    # Rango realmente consultado: si el plan del dueño no llega tan atrás como se
    # pidió, desde_efectivo es el piso aplicado y recortado queda en true.
    desde_efectivo: datetime
    recortado: bool
    retencion_dias: Optional[int] = None
    # Resolución realmente usada; None = puntos crudos, sin agregar.
    bucket_seg: Optional[float] = None
    # Muestreo esperado del equipo: con esto el front sabe qué separación entre
    # lecturas es un hueco real y cuál es el ritmo normal.
    intervalo_seg: int
