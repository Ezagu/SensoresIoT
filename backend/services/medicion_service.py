import bisect
import psycopg2.extras
from datetime import datetime, timezone, timedelta
from db import get_connection
from repositories import dispositivo_repo, sensor_repo, medicion_repo
from services import plan_service

TOLERANCIA_JITTER = timedelta(seconds=2)  # margen por drift de reloj / latencia de red
# Igual a la retention policy del raw (db/init.sql): insertar algo más viejo crea
# un chunk que la policy dropea acto seguido, no sirve de nada. No depende del plan:
# el free escribe con la misma profundidad que el premium y sólo ve menos al leer,
# así el historial aparece entero si algún día contrata.
ANTIGUEDAD_MAXIMA = timedelta(days=90)

def _obtener_intervalo_minimo(cur, dispositivo_id, intervalo_configurado_seg) -> timedelta:
    # El piso sale del plan del dueño (uno sin owner, o cuyo dueño no tiene
    # suscripción vigente, cae en free); el dueño puede pedir algo más lento por
    # autonomía de batería/buffer, nunca más rápido que el piso. El clamp se
    # aplica acá, en cada request, así un downgrade nunca pisa lo que el dueño
    # configuró — sólo deja de cumplirse hasta que vuelva a subir de plan.
    piso = plan_service.limites_de_dispositivo(cur, dispositivo_id)["intervalo_minimo_seg"]
    efectivo = max(intervalo_configurado_seg, piso) if intervalo_configurado_seg is not None else piso
    return timedelta(seconds=efectivo)

def _clasificar(existentes: list, timestamp, umbral) -> str | None:
    """
    Compara una lectura contra las que ya hay guardadas de ese sensor:
    - "duplicada": misma hora exacta. Es el reenvío de un chunk cuya respuesta se
      perdió; el dato ya está, no es un error del equipo.
    - "intervalo": hay otra a menos de `umbral`, el equipo está midiendo de más.
    - None: entra.
    """
    posicion = bisect.bisect_left(existentes, timestamp)

    if posicion < len(existentes) and existentes[posicion] == timestamp:
        return "duplicada"

    # Sólo los dos vecinos inmediatos: si esos están lejos, el resto también.
    for vecino in existentes[max(posicion - 1, 0):posicion + 1]:
        if abs(vecino - timestamp) < umbral:
            return "intervalo"

    return None

def crear_medicion(time, mediciones, dispositivo_id, rotacion_pendiente=False, intervalo_configurado_seg=None) -> dict:
    ahora = datetime.now(timezone.utc)
    timestamp_batch = time or ahora

    with get_connection() as conn:
        # Cursor dict aparte sólo para leer el plan: el de abajo devuelve tuplas
        # porque ids_por_dispositivo y mediciones_en_ventana desempaquetan por
        # posición. Misma conexión y misma transacción.
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur_plan:
            intervalo_minimo = _obtener_intervalo_minimo(cur_plan, dispositivo_id, intervalo_configurado_seg)
        umbral = intervalo_minimo - TOLERANCIA_JITTER

        with conn.cursor() as cur:
            # last_seen_at es "cuándo habló el equipo", no la hora del dato: un flush
            # del buffer trae lecturas viejas y lo dejaría figurando como desconectado
            # justo cuando acaba de reportar.
            dispositivo_repo.actualizar_conexion(cur, dispositivo_id, ahora)

            ids_sensores = sensor_repo.ids_por_dispositivo(cur, dispositivo_id)

            invalidas = []
            duplicadas = []
            descartadas_por_intervalo = []
            candidatas = []

            for medicion in mediciones:
                if medicion.sensor_id not in ids_sensores:
                    invalidas.append(str(medicion.sensor_id))
                    continue

                timestamp = medicion.time or timestamp_batch
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)

                # Fuera de rango: del futuro (reloj del equipo mal sincronizado) o más
                # vieja que lo que retenemos.
                if timestamp > ahora + TOLERANCIA_JITTER or timestamp < ahora - ANTIGUEDAD_MAXIMA:
                    invalidas.append(str(medicion.sensor_id))
                    continue

                candidatas.append((timestamp, medicion.sensor_id, medicion.value))

            # Ordenadas por tiempo para poder comparar cada lectura contra la anterior
            # del mismo sensor dentro del propio batch: cuando el firmware drena su
            # buffer llegan varias lecturas por sensor en un mismo request.
            candidatas.sort(key=lambda fila: fila[0])

            ventana = {}
            if candidatas:
                # Alcanza con traer lo que ya está guardado alrededor del batch: algo a
                # más de un intervalo de distancia no cambia ninguna decisión.
                ventana = medicion_repo.mediciones_en_ventana(
                    cur,
                    list({sensor_id for _, sensor_id, _ in candidatas}),
                    candidatas[0][0] - intervalo_minimo,
                    candidatas[-1][0] + intervalo_minimo,
                )

            filas = []
            for timestamp, sensor_id, value in candidatas:
                existentes = ventana.setdefault(sensor_id, [])
                motivo = _clasificar(existentes, timestamp, umbral)

                if motivo == "duplicada":
                    duplicadas.append(str(sensor_id))
                    continue
                if motivo == "intervalo":
                    descartadas_por_intervalo.append(str(sensor_id))
                    continue

                # Se suma a la ventana para que la siguiente lectura del mismo sensor se
                # compare también contra ésta: sin esto un batch con 50 lecturas del
                # mismo sensor separadas por 1 s entraría entero.
                bisect.insort(existentes, timestamp)
                filas.append((timestamp, sensor_id, value))

            insertadas = medicion_repo.insertar_muchas(cur, filas)

    return {
        "status": "ok",
        "aceptadas": insertadas,
        # reenvíos del buffer que ya estaban guardadas (respuesta perdida en el camino).
        # La diferencia con `insertadas` cubre la carrera entre dos requests del mismo
        # equipo, que frena el ON CONFLICT del insert.
        "duplicadas": len(duplicadas) + (len(filas) - insertadas),
        "rechazadas_invalidas": invalidas,
        "rechazadas_por_intervalo": descartadas_por_intervalo,
        "intervalo_sugerido": int(intervalo_minimo.total_seconds()),
        # el firmware lee este flag y dispara la rotación de su secret en el próximo ciclo
        "rotar_secret": bool(rotacion_pendiente),
    }
