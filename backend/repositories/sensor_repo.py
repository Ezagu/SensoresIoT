def buscar_por_dispositivo_id(cur, dispositivo_id) -> list[dict]:
    cur.execute("SELECT * FROM sensores WHERE dispositivo_id = %s", (dispositivo_id,))
    return cur.fetchall()