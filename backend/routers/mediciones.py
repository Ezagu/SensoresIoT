from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from models.medicion import MedicionCreate

from db import get_connection

router = APIRouter()

@router.post("/medicion")
def create_medicion(medicion: MedicionCreate):
    timestamp = medicion.time or datetime.now(timezone.utc)

    with get_connection() as conn:
        with conn.cursor() as curs:
            curs.execute(
                "SELECT 1 FROM sensores WHERE id = %s",
                (medicion.sensor_id,)
            )
            if curs.fetchone() is None:
                raise HTTPException(404, "Sensor no encontrado")

            curs.execute(
                "INSERT INTO mediciones (time, sensor_id, value) VALUES (%s, %s, %s)",
                (timestamp, medicion.sensor_id, medicion.value)
            )

    return {"status": "ok"}