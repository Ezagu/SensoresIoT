def insertar(cur, timestamp, sensor_id, value) -> None:
    cur.execute(
        "INSERT INTO mediciones (time, sensor_id, value) VALUES (%s, %s, %s)",
        (timestamp, sensor_id, value)
    )

def buscar_puntos(cur, sensor_id, desde, hasta, intervalo) -> list[dict]:
    cur.execute(
        """
        SELECT time_bucket(%s, time) AS bucket,
            AVG(value) AS promedio, MIN(value) AS minimo, MAX(value) AS maximo
        FROM mediciones
        WHERE sensor_id = %s AND time >= %s AND time <= %s
        GROUP BY bucket ORDER BY bucket ASC
        """,
        (intervalo, sensor_id, desde, hasta)
    )
    return cur.fetchall()

def buscar_resumen(cur, sensor_id, desde, hasta) -> dict:
    cur.execute(
        """
        SELECT AVG(value) AS promedio, MIN(value) AS minimo, MAX(value) AS maximo
        FROM mediciones WHERE sensor_id = %s AND time >= %s AND time <= %s
        """,
        (sensor_id, desde, hasta)
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