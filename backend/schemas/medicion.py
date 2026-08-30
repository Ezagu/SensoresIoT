from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Medicion(BaseModel):
    sensor_id: UUID
    value: float
    time: Optional[datetime] = None

class MedicionCreate(BaseModel):
    time: Optional[datetime] = None
    mediciones: list[Medicion]

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
