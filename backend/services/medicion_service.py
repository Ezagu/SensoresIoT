import bisect
from datetime import datetime, timezone, timedelta
from db import get_cursor
from repositories import dispositivo_repo, sensor_repo, medicion_repo, alerta_repo
from services import plan_service, alerta_service, dispositivo_service
from core.tiempo import a_utc

# margen por drift de reloj / latencia de red
TOLERANCIA_JITTER = timedelta(seconds=30)  
# Tiempo máximo que se retiene las mediciones RAW
ANTIGUEDAD_MAXIMA = timedelta(days=90)
# Piso duro de escritura, NO la cadencia del equipo. Sólo frena a un equipo con
# firmware roto; la cadencia viaja como `intervalo_sugerido`. Atarlo al intervalo
# configurado descartaría lo que llega antes de tiempo a propósito: el disparo
# fuera de ciclo de una alerta.
UMBRAL_THROTTLE = timedelta(seconds=dispositivo_service.INTERVALO_MIN_MUESTREO_SEG - 3)

def motivo_de_descarte(existentes: list, timestamp) -> str | None:
    # Indica en que posición de la lista ordenada debería insertarse el timestamp para mantener el orden.
    posicion = bisect.bisect_left(existentes, timestamp)

    # Mismo timestamp exacto: reenvío de un lote cuya respuesta se perdió.
    if posicion < len(existentes) and existentes[posicion] == timestamp:
        return "duplicada"

    # Se fija si hay un vecino a menos de UMBRAL_THROTTLE antes o después del timestamp.
    for vecino in existentes[max(posicion - 1, 0):posicion + 1]:
        if abs(vecino - timestamp) < UMBRAL_THROTTLE:
            return "intervalo"

    return None

def _loguear_descartadas(dispositivo_id, recibidas: int, descartadas: dict, en_carrera: int) -> None:
    # Al equipo no le sirve: la respuesta sigue siendo 2xx. Es para detectar un
    # reloj corrido o UUIDs de sensores mal compilados, que si no se pierden en silencio.
    conteos = {motivo: len(ids) for motivo, ids in descartadas.items() if ids}
    if en_carrera:
        conteos["duplicada"] = conteos.get("duplicada", 0) + en_carrera
    if not conteos:
        return

    detalle = f" sensores_ajenos={sorted(set(descartadas['sensor_ajeno']))}" if descartadas["sensor_ajeno"] else ""
    print(f"[Mediciones {dispositivo_id}] recibidas={recibidas} descartadas={conteos}{detalle}")

def crear_medicion(mediciones, dispositivo):
    ahora = datetime.now(timezone.utc)

    notificaciones = []
    umbrales = []
    descartadas = {"sensor_ajeno": [], "sin_hora": [], "fuera_de_rango": [], "duplicada": [], "intervalo": []}

    with get_cursor() as cur:
        limites = plan_service.limites_de_dispositivo(cur, dispositivo["id"])
        # Sólo para responderle al equipo qué cadencia usar; lo que se acepta
        # escribir es UMBRAL_THROTTLE, que no depende de esto.
        intervalo_sugerido = plan_service.intervalo_efectivo_seg(dispositivo["intervalo_configurado_seg"], limites["intervalo_minimo_seg"])

        # Actualiza last_seen_at con la hora actual y last_data_at sólo si el POST traía mediciones.
        # Un heartbeat dice que el equipo está vivo, no que sus sensores anden.
        dispositivo_repo.actualizar_conexion(cur, dispositivo["id"], ahora, con_datos=bool(mediciones))

        ids_sensores = sensor_repo.ids_por_dispositivo(cur, dispositivo["id"])

        medicionesCandidatas = []

        for medicion in mediciones:
            if medicion.sensor_id not in ids_sensores:
                descartadas["sensor_ajeno"].append(str(medicion.sensor_id))
                continue

            if medicion.time is None:
                descartadas["sin_hora"].append(str(medicion.sensor_id))
                continue

            timestamp = a_utc(medicion.time)

            # Fuera de rango: del futuro o más vieja que lo que retenemos.
            if timestamp > ahora + TOLERANCIA_JITTER or timestamp < ahora - ANTIGUEDAD_MAXIMA:
                descartadas["fuera_de_rango"].append(str(medicion.sensor_id))
                continue

            medicionesCandidatas.append((timestamp, medicion.sensor_id, medicion.value))

        # Ordenadas por tiempo para poder comparar cada lectura contra la
        # anterior del mismo sensor dentro del propio batch
        medicionesCandidatas.sort(key=lambda fila: fila[0])

        ventana = {}
        if medicionesCandidatas:
            # Se traen las mediciones ya guardadas de los sensores que vienen en el batch, en el mismo rango de tiempo
            sensores_ids_en_mediciones = list({sensor_id for _, sensor_id, _ in medicionesCandidatas})
            inicio = medicionesCandidatas[0][0] - UMBRAL_THROTTLE
            fin = medicionesCandidatas[-1][0] + UMBRAL_THROTTLE
            ventana = medicion_repo.mediciones_en_ventana(cur, sensores_ids_en_mediciones, inicio, fin)

        filas = []
        for timestamp, sensor_id, value in medicionesCandidatas:
            medicionesExistentes = ventana.setdefault(sensor_id, [])
            motivo = motivo_de_descarte(medicionesExistentes, timestamp)

            if motivo:
                descartadas[motivo].append(str(sensor_id))
                continue

            # Se suma a la ventana para que la siguiente lectura del mismo sensor la tenga en cuenta
            bisect.insort(medicionesExistentes, timestamp)
            filas.append((timestamp, sensor_id, value))

        insertadas = medicion_repo.insertar_muchas(cur, filas)

        if limites["puede_alertas"]:
            if filas:
                notificaciones = alerta_service.evaluar_batch(cur, filas, ahora)
            umbrales = alerta_repo.umbrales_por_dispositivo(cur, dispositivo["id"])

    # len(filas) - insertadas es lo que frenó el ON CONFLICT: dos requests del mismo equipo en carrera.
    _loguear_descartadas(dispositivo["id"], len(mediciones), descartadas, len(filas) - insertadas)

    return {
        "status": "ok",
        # Se le pasa al equipo para que sepa si su reloj está atrasado o adelantado y pueda corregirlo
        "server_epoch": int(ahora.timestamp()),
        "intervalo_sugerido_seg": intervalo_sugerido,
        # Cada cuánto tiene que contactarse, publique o no.
        "intervalo_contacto_seg": dispositivo_service.INTERVALO_CONTACTO_SEG,
        # El dispositivo cada que muestrea revisa las alertas, si alguna se dispara "muestras"veces seguidas, entonces el equipo la reporta.
        "umbrales": [
            {
                "sensor_id": str(u["sensor_id"]),
                "condicion": u["condicion"],
                "umbral": u["umbral"],
                "histeresis": u["histeresis"],
                "muestras": u["muestras_confirmacion"],
                "disparada": u["disparada"],
            }
            for u in umbrales
        ],
        # el dispositivo lee este flag y dispara la rotación de su secret en el próximo ciclo
        "rotar_secret": bool(dispositivo["rotacion_pendiente"]),
    }, notificaciones
