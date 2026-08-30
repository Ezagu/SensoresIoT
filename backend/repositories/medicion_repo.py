from datetime import timedelta, datetime, timezone
from psycopg2.extras import execute_values

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
    # Tabla más barata cuya granularidad alcanza el bucket pedido; si su retención
    # no llega tan atrás, escala a la siguiente más gruesa (mejor menos detalle que vacío).
    candidatas = [f for f in FUENTES if f["granularidad"] <= bucket_objetivo]
    fuente = candidatas[-1] if candidatas else FUENTES[0]

    indice = FUENTES.index(fuente)
    while fuente["retencion"] is not None and antiguedad > fuente["retencion"]:
        indice += 1
        if indice >= len(FUENTES):
            break
        fuente = FUENTES[indice]

    return fuente

def insertar_muchas(cur, filas: list[tuple]) -> int:
    # ON CONFLICT DO NOTHING contra idx_mediciones_unico (sensor_id, time): hace
    # seguro el reintento de un chunk cuya respuesta se perdió, sin duplicar el punto.
    if not filas:
        return 0

    execute_values(
        cur,
        "INSERT INTO mediciones (time, sensor_id, value) VALUES %s ON CONFLICT DO NOTHING",
        filas
    )
    return cur.rowcount

def mediciones_en_ventana(cur, sensor_ids: list, desde, hasta) -> dict:
    # {sensor_id: [time, ...]} ordenado, para comparar cada lectura entrante
    # contra su vecina real (un flush del buffer puede traer datos viejos).
    if not sensor_ids:
        return {}

    cur.execute(
        """
        SELECT sensor_id, time
        FROM mediciones
        WHERE sensor_id = ANY(%s) AND time >= %s AND time <= %s
        ORDER BY sensor_id, time
        """,
        (sensor_ids, desde, hasta)
    )

    ventana = {}
    for sensor_id, momento in cur.fetchall():
        ventana.setdefault(sensor_id, []).append(momento)
    return ventana

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

    # Acá el objetivo es el rango completo, no rango/TARGET_PUNTO: la granularidad
    # de la tabla tiene que entrar entera o el bucket no matchea ninguna fila.
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

def inicio_historial(cur, sensor_ids: list):
    # El raw sólo guarda 90 días; el arranque real del historial está en el
    # agregado diario (retención indefinida). LEAST ignora NULLs, así que sirve
    # tanto para un dispositivo viejo como para uno recién instalado sin agregado aún.
    if not sensor_ids:
        return None

    cur.execute(
        """
        SELECT LEAST(
            (SELECT min(bucket) FROM mediciones_por_dia WHERE sensor_id = ANY(%s)),
            (SELECT min(time)   FROM mediciones         WHERE sensor_id = ANY(%s))
        ) AS inicio
        """,
        (sensor_ids, sensor_ids)
    )
    fila = cur.fetchone()
    return fila["inicio"] if fila else None

def fuente_para_export(desde, intervalo_seg: int | None = None) -> tuple[dict, timedelta | None]:
    # bucket None = no reagrupar, una fila por timestamp guardado.
    #
    # Sin intervalo pedido el export es "todo lo que hay": arranca en raw y sólo
    # baja de resolución cuando la retención ya no llega tan atrás — el criterio
    # inverso a _elegir_fuente, que busca la tabla más barata para ~200 puntos.
    # Con intervalo pedido el caller aceptó un agregado, así que ahí sí conviene
    # _elegir_fuente (1 h sobre dos meses se sirve del CAGG horario, no de raw).
    antiguedad = datetime.now(timezone.utc) - desde

    if intervalo_seg is None:
        for fuente in FUENTES:
            if fuente["retencion"] is None or antiguedad <= fuente["retencion"]:
                return fuente, None
        return FUENTES[-1], None

    pedido = timedelta(seconds=intervalo_seg)
    fuente = _elegir_fuente(pedido, antiguedad)
    # Sobre un agregado no se puede bajar de su granularidad nativa; sobre raw se
    # respeta lo pedido tal cual (aunque quede más fino que los 30 s nominales).
    bucket = pedido if fuente["es_raw"] else max(pedido, fuente["granularidad"])
    return fuente, bucket

def export_con_stats(fuente: dict, bucket) -> bool:
    # True = tres columnas por sensor (prom/min/max) en vez de una con el valor.
    # Pasa cuando la fuente ya viene pre-agregada o cuando el caller pidió agregar.
    return not fuente["es_raw"] or bucket is not None

def iterar_pivot(cur, sensor_ids: list, desde, hasta, fuente: dict, bucket=None):
    # Pivotea N sensores en una fila por instante (FILTER condicional) para que el
    # CSV salga con una columna por sensor en vez de una fila por (sensor, momento).
    # bucket None = agrupa por el timestamp tal cual está guardado, sin re-agregar
    # (dos sensores sellados en segundos distintos salen en filas separadas).
    # Con bucket, cada sensor pasa a tres columnas prom/min/max (export_con_stats).
    #
    # cur tiene que ser un cursor server-side (db.get_cursor_streaming): el
    # resultado puede ser cientos de miles de filas.
    tabla, columna_tiempo = fuente["tabla"], fuente["columna_tiempo"]
    con_stats = export_con_stats(fuente, bucket)

    expr_tiempo = columna_tiempo if bucket is None else f"time_bucket(%s, {columna_tiempo})"

    columnas = []
    for i in range(len(sensor_ids)):
        if not con_stats:
            # avg() es pasamanos: el índice único (sensor_id, time) ya da una sola fila.
            columnas.append(f"avg(value) FILTER (WHERE sensor_id = %s) AS s{i}")
        elif fuente["es_raw"]:
            columnas.append(f"avg(value) FILTER (WHERE sensor_id = %s) AS s{i}_prom")
            columnas.append(f"min(value) FILTER (WHERE sensor_id = %s) AS s{i}_min")
            columnas.append(f"max(value) FILTER (WHERE sensor_id = %s) AS s{i}_max")
        else:
            # Promedio ponderado por cantidad real de mediciones del bucket origen,
            # no promedio de promedios (evita sesgo por huecos de datos).
            columnas.append(
                f"sum(promedio * cantidad) FILTER (WHERE sensor_id = %s) / "
                f"nullif(sum(cantidad) FILTER (WHERE sensor_id = %s), 0) AS s{i}_prom"
            )
            columnas.append(f"min(minimo) FILTER (WHERE sensor_id = %s) AS s{i}_min")
            columnas.append(f"max(maximo) FILTER (WHERE sensor_id = %s) AS s{i}_max")

    por_sensor = 1 if not con_stats else (3 if fuente["es_raw"] else 4)
    params = [] if bucket is None else [bucket]
    for sensor_id in sensor_ids:
        params += [sensor_id] * por_sensor
    params += [sensor_ids, desde, hasta]

    # GROUP BY/ORDER BY posicionales, no por el alias `bucket`: sobre los agregados
    # (que ya tienen una columna `bucket`) el alias colisionaría con la original.
    cur.execute(
        f"""
        SELECT {expr_tiempo} AS bucket, {", ".join(columnas)}
        FROM {tabla}
        WHERE sensor_id = ANY(%s) AND {columna_tiempo} >= %s AND {columna_tiempo} < %s
        GROUP BY 1
        ORDER BY 1
        """,
        params,
    )
    for fila in cur:
        yield fila

def buscar_historial(cur, sensor_id, hasta, cursor, limite, desde=None):
    condiciones = "sensor_id = %s"
    params = [sensor_id]

    tope = cursor if cursor is not None else hasta
    if tope:
        condiciones += " AND time < %s"
        params.append(tope)

    # Piso de la ventana que permite el plan del dueño: al llegar a la frontera
    # vuelven menos filas que `limite` y el servicio deja de emitir cursor.
    if desde is not None:
        condiciones += " AND time >= %s"
        params.append(desde)

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