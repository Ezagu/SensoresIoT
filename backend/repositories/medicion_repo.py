def insertar(cur, timestamp, sensor_id, value) -> None:
    cur.execute(
        "INSERT INTO mediciones (time, sensor_id, value) VALUES (%s, %s, %s)",
        (timestamp, sensor_id, value)
    )
