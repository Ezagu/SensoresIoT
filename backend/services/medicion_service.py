from datetime import datetime, timezone, timedelta
from db import get_connection
from repositories import dispositivo_repo, sensor_repo, medicion_repo

INTERVALO_MINIMO_MEDICION = timedelta(seconds=60)
TOLERANCIA_JITTER = timedelta(seconds=2)  # margen por drift de reloj / latencia de red

def _obtener_intervalo_minimo(dispositivo_id) -> timedelta:
    # hoy es fijo para todos los dispositivos; cuando exista el modelo de
    # plan (Tier 4.1), acá se resuelve según el plan del dueño del dispositivo
    return INTERVALO_MINIMO_MEDICION

def crear_medicion(time, mediciones, dispositivo_id, rotacion_pendiente=False) -> dict:
    timestamp = time or datetime.now(timezone.utc)
    intervalo_minimo = _obtener_intervalo_minimo(dispositivo_id)
    umbral = intervalo_minimo - TOLERANCIA_JITTER

    with get_connection() as conn:
        with conn.cursor() as cur:
            dispositivo_repo.actualizar_conexion(cur, dispositivo_id, timestamp)

            ids_sensores = sensor_repo.ids_por_dispositivo(cur, dispositivo_id)
            sensor_ids_payload = [m.sensor_id for m in mediciones if m.sensor_id in ids_sensores]
            ultimas = medicion_repo.ultima_medicion_por_sensores(cur, sensor_ids_payload)

            invalidas = []
            descartadas_por_intervalo = []

            for medicion in mediciones:
                if medicion.sensor_id not in ids_sensores:
                    invalidas.append(str(medicion.sensor_id))
                    continue

                ultima = ultimas.get(medicion.sensor_id)
                if ultima is not None and (timestamp - ultima) < umbral:
                    descartadas_por_intervalo.append(str(medicion.sensor_id))
                    continue

                medicion_repo.insertar(cur, timestamp, medicion.sensor_id, medicion.value)

    return {
        "status": "ok",
        "rechazadas_invalidas": invalidas,
        "rechazadas_por_intervalo": descartadas_por_intervalo,
        "intervalo_sugerido": int(intervalo_minimo.total_seconds()),
        # el firmware lee este flag y dispara la rotación de su secret en el próximo ciclo
        "rotar_secret": bool(rotacion_pendiente),
    }