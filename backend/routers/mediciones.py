from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from models.medicion import MedicionCreate

from db import get_connection

router = APIRouter()

@router.post("/medicion")
def create_medicion(payload: MedicionCreate):
    timestamp = payload.time or datetime.now(timezone.utc)

    with get_connection() as conn:
        with conn.cursor() as curs:
            # Verificar que exista el dispositivo
            curs.execute(
                "SELECT 1 FROM dispositivos WHERE id = %s",
                (payload.dispositivo_id,)
            )
            if curs.fetchone() is None:
                raise HTTPException(404, "Dispositivo no encontrado")

            # Obtener sensores del dispositivo
            curs.execute(
                "SELECT id FROM sensores WHERE dispositivo_id = %s",
                (payload.dispositivo_id,)
            )
            ids_sensores = {row[0] for row in curs.fetchall()}

            for medicion in payload.mediciones:
                if medicion.sensor_id not in ids_sensores:
                    print(f"El sensor {medicion.sensor_id} no pertenece al dispositivo")
                    continue

                curs.execute(
                    "INSERT INTO mediciones (time, sensor_id, value) VALUES (%s, %s, %s)",
                    (timestamp, medicion.sensor_id, medicion.value)
                )

    return {"status": "ok"}