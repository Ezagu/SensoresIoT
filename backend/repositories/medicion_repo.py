from datetime import timedelta, datetime, timezone

TARGET_PUNTO = 200

# Orden: de más fino (caro) a más grueso (barato).
FUENTES = [
    {
        "tabla": "mediciones",
        "columna_tiempo": "time",
        "granularidad": timedelta(seconds=30),
        "retencion": timedelta(days=90),
        "es_raw": True,
    },
    {
        "tabla": "mediciones_por_hora",
        "columna_tiempo": "bucket",
        "granularidad": timedelta(hours=1),
        "retencion": timedelta(days=365),
        "es_raw": False,
    },
    {
        "tabla": "mediciones_por_dia",
        "columna_tiempo": "bucket",
        "granularidad": timedelta(days=1),
        "retencion": None,  
        "es_raw": False,
    }
]

def _elegir_fuente(bucket_objetivo: timedelta, antiguedad: timedelta) -> dict:
    """
    Elige la tabla más gruesa (barata) que:
    - tenga granularidad nativa <= bucket_objetivo (no perder la resolución pedida)
    - retenga datos hasta la antigüedad del rango solicitado

    Si la elegida por resolución no llega en retención, escala a la siguiente
    tabla más gruesa (mejor devolver algo con menos detalle que devolver vacío).
    """
    candidatas = [f for f in FUENTES if f["granularidad"] <= bucket_objetivo]
    fuente = candidatas[-1] if candidatas else FUENTES[0]

    indice = FUENTES.index(fuente)
    while fuente["retencion"] is not None and antiguedad > fuente["retencion"]:
        indice += 1
        if indice >= len(FUENTES):
            break
        fuente = FUENTES[indice]

    return fuente

def insertar(cur, timestamp, sensor_id, value) -> None:
    cur.execute(
        "INSERT INTO mediciones (time, sensor_id, value) VALUES (%s, %s, %s)",
        (timestamp, sensor_id, value)
    )

def ultima_medicion_por_sensores(cur, sensor_ids: list) -> dict:
    if not sensor_ids:
        return {}

    cur.execute(
        """
        SELECT DISTINCT ON (sensor_id) sensor_id, time
        FROM mediciones
        WHERE sensor_id = ANY(%s)
        ORDER BY sensor_id, time DESC
        """,
        (sensor_ids,)
    )
    return {fila[0]: fila[1] for fila in cur.fetchall()}

def buscar_puntos(cur, sensor_id, desde, hasta) -> list[dict]:
    rango = hasta - desde
    bucket_objetivo = max(rango / TARGET_PUNTO, timedelta(seconds=30))
    antiguedad = datetime.now(timezone.utc) - desde

    fuente = _elegir_fuente(bucket_objetivo, antiguedad)
    tabla, columna_tiempo = fuente["tabla"], fuente["columna_tiempo"]

    if fuente["es_raw"]:
        select_stats = "avg(value) AS promedio, min(value) AS minimo, max(value) AS maximo"
    else:
        # promedio ponderado por cantidad real de mediciones por bucket,
        # no un promedio simple de promedios (evita sesgo por huecos de datos)
        select_stats = (
            "sum(promedio * cantidad) / sum(cantidad) AS promedio, "
            "min(minimo) AS minimo, max(maximo) AS maximo"
        )

    cur.execute(
        f"""
        SELECT
            time_bucket(%s, {columna_tiempo}) AS bucket,
            {select_stats}
        FROM {tabla}
        WHERE sensor_id = %s AND {columna_tiempo} >= %s AND {columna_tiempo} <= %s
        GROUP BY bucket
        ORDER BY bucket
        """,
        (bucket_objetivo, sensor_id, desde, hasta),
    )
    return cur.fetchall()


def buscar_resumen(cur, sensor_id, desde, hasta) -> dict:
    rango = hasta - desde
    antiguedad = datetime.now(timezone.utc) - desde

    # acá el objetivo NO es rango/250: necesitamos que la granularidad de la
    # tabla entre completa dentro del rango pedido, si no el filtro por bucket
    # puede no matchear nada (ver explicación arriba)
    fuente = _elegir_fuente(rango, antiguedad)
    tabla, columna_tiempo = fuente["tabla"], fuente["columna_tiempo"]

    if fuente["es_raw"]:
        select_stats = "avg(value) AS promedio, min(value) AS minimo, max(value) AS maximo"
    else:
        select_stats = (
            "sum(promedio * cantidad) / sum(cantidad) AS promedio, "
            "min(minimo) AS minimo, max(maximo) AS maximo"
        )

    cur.execute(
        f"""
        SELECT {select_stats}
        FROM {tabla}
        WHERE sensor_id = %s AND {columna_tiempo} >= %s AND {columna_tiempo} <= %s
        """,
        (sensor_id, desde, hasta),
    )
    return cur.fetchone()

def buscar_historial(cur, sensor_id, hasta, cursor, limite):
    condiciones = "sensor_id = %s"
    params = [sensor_id]

    tope = cursor if cursor is not None else hasta
    if tope:
        condiciones += " AND time < %s"
        params.append(tope)
    params.append(limite)

    cur.execute(
        f"""
        SELECT time, value FROM mediciones
        WHERE {condiciones}
        ORDER BY time DESC
        LIMIT %s
        """,
        params
    )
    return cur.fetchall()