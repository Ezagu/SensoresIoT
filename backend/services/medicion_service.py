import bisect
import psycopg2.extras
from datetime import datetime, timezone, timedelta
from db import get_connection
from repositories import dispositivo_repo, sensor_repo, medicion_repo, alerta_repo
from services import plan_service, alerta_service, dispositivo_service
from core.tiempo import a_utc

TOLERANCIA_JITTER = timedelta(seconds=5)  # margen por drift de reloj / latencia de red
# No depende del plan: el free escribe con la misma profundidad que el premium y
# sólo ve menos al leer, así el historial aparece entero si algún día contrata.
ANTIGUEDAD_MAXIMA = timedelta(days=90)
# Piso duro de escritura, NO la cadencia del equipo. Sólo frena a un equipo con
# firmware roto; la cadencia viaja como `intervalo_sugerido`. Atarlo al intervalo
# configurado descartaría lo que llega antes de tiempo a propósito: el disparo
# fuera de ciclo de una alerta, el arranque rápido y el modo vivo.
UMBRAL_THROTTLE = timedelta(seconds=10)

# Arranque rápido: al enchufar un equipo por primera vez publica seguido, así el
# cliente ve la serie moverse mientras lo instala en vez de esperar 5 minutos por
# el segundo punto. No depende del plan — es la primera impresión del producto,
# no una feature. Pasada la ventana cae solo a la cadencia configurada.
VENTANA_ARRANQUE = timedelta(minutes=30)
INTERVALO_ARRANQUE_SEG = 15

def _en_arranque(first_connected_at, ahora) -> bool:
    # None = este POST es el primero de su vida; actualizar_conexion lo sella
    # más abajo, en esta misma transacción.
    return first_connected_at is None or (ahora - first_connected_at) < VENTANA_ARRANQUE

def _clasificar(existentes: list, timestamp) -> str | None:
    """
    Compara una lectura contra las que ya hay guardadas de ese sensor:
    - "duplicada": misma hora exacta. Es el reenvío de un chunk cuya respuesta se
      perdió; el dato ya está, no es un error del equipo.
    - "intervalo": hay otra a menos de UMBRAL_THROTTLE, el equipo está midiendo de más.
    - None: entra.
    """
    posicion = bisect.bisect_left(existentes, timestamp)

    if posicion < len(existentes) and existentes[posicion] == timestamp:
        return "duplicada"

    # Sólo los dos vecinos inmediatos: si esos están lejos, el resto también.
    for vecino in existentes[max(posicion - 1, 0):posicion + 1]:
        if abs(vecino - timestamp) < UMBRAL_THROTTLE:
            return "intervalo"

    return None

def crear_medicion(time, mediciones, dispositivo_id, rotacion_pendiente=False, intervalo_configurado_seg=None, first_connected_at=None):
    ahora = datetime.now(timezone.utc)
    timestamp_batch = time or ahora

    notificaciones = []
    umbrales = []

    with get_connection() as conn:
        # Cursor dict para el plan: se mantiene abierto hasta el final para
        # evaluar alertas ahí (necesita RealDictCursor); el de abajo devuelve
        # tuplas porque los repos que siguen desempaquetan por posición.
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur_plan:
            limites = plan_service.limites_de_dispositivo(cur_plan, dispositivo_id)
            # Sólo para responderle al equipo qué cadencia usar; lo que se acepta
            # escribir es UMBRAL_THROTTLE, que no depende de esto.
            intervalo_sugerido = (
                INTERVALO_ARRANQUE_SEG if _en_arranque(first_connected_at, ahora)
                else plan_service.intervalo_efectivo_seg(
                    intervalo_configurado_seg, limites["intervalo_minimo_seg"]
                )
            )

            with conn.cursor() as cur:
                # last_seen_at es "cuándo habló el equipo", no la hora del dato: un
                # flush del buffer trae lecturas viejas y lo dejaría figurando como
                # desconectado justo cuando acaba de reportar.
                #
                # Un batch vacío es un heartbeat: el equipo dice "sigo acá" sin
                # tener nada que publicar. Mueve last_seen_at pero NO last_data_at,
                # que es lo que separa "está vivo" de "sus sensores andan".
                dispositivo_repo.actualizar_conexion(cur, dispositivo_id, ahora, con_datos=bool(mediciones))

                ids_sensores = sensor_repo.ids_por_dispositivo(cur, dispositivo_id)

                invalidas = []
                duplicadas = []
                descartadas_por_intervalo = []
                candidatas = []

                for medicion in mediciones:
                    if medicion.sensor_id not in ids_sensores:
                        invalidas.append(str(medicion.sensor_id))
                        continue

                    timestamp = a_utc(medicion.time) or timestamp_batch

                    # Fuera de rango: del futuro (reloj del equipo mal sincronizado)
                    # o más vieja que lo que retenemos.
                    if timestamp > ahora + TOLERANCIA_JITTER or timestamp < ahora - ANTIGUEDAD_MAXIMA:
                        invalidas.append(str(medicion.sensor_id))
                        continue

                    candidatas.append((timestamp, medicion.sensor_id, medicion.value))

                # Ordenadas por tiempo para poder comparar cada lectura contra la
                # anterior del mismo sensor dentro del propio batch: cuando el
                # firmware drena su buffer llegan varias lecturas por sensor en un
                # mismo request. La evaluación de alertas reusa este mismo orden.
                candidatas.sort(key=lambda fila: fila[0])

                ventana = {}
                if candidatas:
                    # Alcanza con traer lo que ya está guardado alrededor del batch:
                    # algo a más de un intervalo de distancia no cambia ninguna decisión.
                    ventana = medicion_repo.mediciones_en_ventana(
                        cur,
                        list({sensor_id for _, sensor_id, _ in candidatas}),
                        candidatas[0][0] - UMBRAL_THROTTLE,
                        candidatas[-1][0] + UMBRAL_THROTTLE,
                    )

                filas = []
                for timestamp, sensor_id, value in candidatas:
                    existentes = ventana.setdefault(sensor_id, [])
                    motivo = _clasificar(existentes, timestamp)

                    if motivo == "duplicada":
                        duplicadas.append(str(sensor_id))
                        continue
                    if motivo == "intervalo":
                        descartadas_por_intervalo.append(str(sensor_id))
                        continue

                    # Se suma a la ventana para que la siguiente lectura del mismo
                    # sensor se compare también contra ésta: sin esto un batch con
                    # 50 lecturas del mismo sensor separadas por 1 s entraría entero.
                    bisect.insort(existentes, timestamp)
                    filas.append((timestamp, sensor_id, value))

                insertadas = medicion_repo.insertar_muchas(cur, filas)

            # Sólo si el owner es premium: un free no paga ni la query de lectura
            # de reglas activas. Va después de insertar, misma transacción: si el
            # commit falla, no queda un evento de alerta huérfano sin su medición.
            if limites["puede_alertas"]:
                if filas:
                    notificaciones = alerta_service.evaluar_batch(cur_plan, filas, ahora)
                # Copia plana de las reglas para que el equipo adelante el envío
                # al cruzar un umbral. Va en cada respuesta: así una regla nueva
                # llega sola y un equipo que rebootó se recupera sin nada extra.
                umbrales = alerta_repo.umbrales_por_dispositivo(cur_plan, dispositivo_id)

    return {
        "status": "ok",
        "aceptadas": insertadas,
        # reenvíos del buffer que ya estaban guardadas (respuesta perdida en el camino).
        # La diferencia con `insertadas` cubre la carrera entre dos requests del mismo
        # equipo, que frena el ON CONFLICT del insert.
        "duplicadas": len(duplicadas) + (len(filas) - insertadas),
        "rechazadas_invalidas": invalidas,
        "rechazadas_por_intervalo": descartadas_por_intervalo,
        # El equipo a batería no tiene reloj: guarda la EDAD de cada lectura y la
        # convierte a fecha con este ancla. Va por acá y no por SNTP para no
        # depender del UDP 123 ni del pool de terceros, cuyos términos prohíben
        # usarlo como default en un producto que se distribuye.
        "server_epoch": int(ahora.timestamp()),
        "intervalo_sugerido_seg": intervalo_sugerido,
        # Cada cuánto tiene que HABLAR, publique o no. Va desde el servidor y no
        # hardcodeado en el sketch: con una compilación por pedido, una constante
        # del lado de la placa es una decisión que se arrastra años.
        "intervalo_contacto_seg": dispositivo_service.INTERVALO_CONTACTO_SEG,
        # El equipo compara cada muestra contra esto y, si CRUZA (transición, no
        # estado), drena el buffer sin esperar el ciclo. No evalúa la alerta: la
        # máquina de estados y el mail siguen siendo del servidor.
        "umbrales": [
            {
                "sensor_id": str(u["sensor_id"]),
                "condicion": u["condicion"],
                "umbral": u["umbral"],
                "histeresis": u["histeresis"],
                "muestras": u["muestras_confirmacion"],
            }
            for u in umbrales
        ],
        # el firmware lee este flag y dispara la rotación de su secret en el próximo ciclo
        "rotar_secret": bool(rotacion_pendiente),
    }, notificaciones
