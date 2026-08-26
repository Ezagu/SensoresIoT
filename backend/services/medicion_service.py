from fastapi import HTTPException
from datetime import datetime, timezone
from db import get_connection
from repositories import dispositivo_repo, sensor_repo, medicion_repo

def crear_medicion(payload) -> dict:
    timestamp = payload.time or datetime.now(timezone.utc)
    with get_connection() as conn:
        with conn.cursor() as cur:
            existe = dispositivo_repo.actualizar_conexion(cur, payload.dispositivo_id, timestamp)
            if not existe:
                raise HTTPException(404, "Dispositivo no encontrado")

            ids_sensores = sensor_repo.ids_por_dispositivo(cur, payload.dispositivo_id)
            print(ids_sensores)

            rechazadas = []
            for medicion in payload.mediciones:
                print(medicion.sensor_id)
                print(medicion.sensor_id in ids_sensores)
                if medicion.sensor_id not in ids_sensores:
                    rechazadas.append(str(medicion.sensor_id))
                    continue
                medicion_repo.insertar(cur, timestamp, medicion.sensor_id, medicion.value)

    return {"status": "ok", "rechazadas": rechazadas}