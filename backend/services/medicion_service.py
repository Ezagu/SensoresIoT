from fastapi import HTTPException
from datetime import datetime, timezone
from db import get_connection
from repositories import dispositivo_repo, sensor_repo, medicion_repo

def crear_medicion(time, mediciones, dispositivo_id) -> dict:
    timestamp = time or datetime.now(timezone.utc)
    with get_connection() as conn:
        with conn.cursor() as cur:
            dispositivo_repo.actualizar_conexion(cur, dispositivo_id, timestamp)

            ids_sensores = sensor_repo.ids_por_dispositivo(cur, dispositivo_id)

            rechazadas = []
            for medicion in mediciones:
                if medicion.sensor_id not in ids_sensores:
                    rechazadas.append(str(medicion.sensor_id))
                    continue
                medicion_repo.insertar(cur, timestamp, medicion.sensor_id, medicion.value)

    return {"status": "ok", "rechazadas": rechazadas}