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
            curs.execute(
                "SELECT first_connected_at FROM dispositivos WHERE id = %s",
                (payload.dispositivo_id,)
            )
            first_connected_at = curs.fetchone()
            
            # Verificar que exista el dispositivo
            if first_connected_at is None:
                raise HTTPException(404, "Dispositivo no encontrado")

            # Modificar last seen at y first connected at
            if first_connected_at[0] is None:
                curs.execute(
                    """
                    UPDATE dispositivos 
                    SET first_connected_at = %s,
                        last_seen_at = %s
                    WHERE id = %s
                    """,
                    (timestamp, timestamp, payload.dispositivo_id)
                )
            else:
                curs.execute(
                    "UPDATE dispositivos SET last_seen_at = %s WHERE id = %s",
                    (timestamp, payload.dispositivo_id)
                )

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