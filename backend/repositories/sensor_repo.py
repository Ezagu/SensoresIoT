def buscar_por_dispositivo_id(cur, dispositivo_id) -> list[dict]:
    cur.execute("SELECT * FROM sensores WHERE dispositivo_id = %s", (dispositivo_id,))
    return cur.fetchall()

def ids_por_dispositivo(cur, dispositivo_id) -> set:
    cur.execute("SELECT id FROM sensores WHERE dispositivo_id = %s", (dispositivo_id,))
    return {row[0] for row in cur.fetchall()}