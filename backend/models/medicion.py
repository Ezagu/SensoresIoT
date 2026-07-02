from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MedicionCreate(BaseModel):
    sensor_id: str
    value: float
    time: Optional[datetime] = None

class MedicionOut(BaseModel):
    value: float
    time: datetime