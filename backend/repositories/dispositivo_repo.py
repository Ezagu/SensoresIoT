import psycopg2.errors
from fastapi import HTTPException
from core.security import generar_secret

COLUMNAS_PUBLICAS = "id, nombre, ubicacion, descripcion, activo, last_seen_at, first_connected_at, intervalo_configurado_seg"

def verificar_ownership_dispositivo(cur, dispositivo_id, usuario_id) -> bool:
    # Verifica si un usuario esta asociado al dispositivo
    cur.execute(
        """
        SELECT 1 FROM usuario_dispositivo
        WHERE usuario_id = %s AND dispositivo_id = %s
        """,
        (usuario_id, dispositivo_id)
    )
    return cur.fetchone() is not None

def crear(cur, nombre: str, ubicacion: str, descripcion: str) -> dict:
    # Crea un dispositivo y devuelve el secret para colocarlo en el firmware del ESP y usarlo como autenticación
    secret, secret_hash = generar_secret()
    try:
        cur.execute(
            f"""
            INSERT INTO dispositivos (nombre, ubicacion, descripcion, secret_hash)
            VALUES (%s, %s, %s, %s)
            RETURNING {COLUMNAS_PUBLICAS}
            """,
            (nombre, ubicacion, descripcion, secret_hash)
        )
        dispositivo = cur.fetchone()
        return {"dispositivo": dispositivo, "secret": secret}
    except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(404, "El usuario no existe")

def actualizar_secret(cur, dispositivo_id) -> str:
    # Genera un nuevo secret de dispositivo para agregarlo al firmware del ESP y auntentificar el envio de datos
    secret, secret_hash = generar_secret()
    cur.execute(
        """
        UPDATE dispositivos
        SET secret_hash = %s
        WHERE id = %s
        RETURNING id
        """,
        (secret_hash, dispositivo_id)
    )
    disp = cur.fetchone()
    if not disp:
        raise HTTPException(404, "Dispositivo no encontrado")
    return secret

def rotar_secret(cur, dispositivo_id) -> str:
    # Rotación device-initiated: el secret actual pasa a secret_hash_anterior y sigue
    # siendo válido hasta que el dispositivo se autentique con el nuevo. Si la respuesta
    # se pierde en el camino, el equipo puede seguir entrando con el viejo y reintentar.
    #
    # El COALESCE es lo que hace seguro el reintento: si ya hay una rotación sin
    # confirmar, se conserva el último secret que el dispositivo confirmó tener. Pisarlo
    # con el intermedio (que el equipo nunca llegó a recibir) lo dejaría sin ningún
    # secret válido, que es justo el brick que este diseño evita.
    secret, secret_hash = generar_secret()
    cur.execute(
        """
        UPDATE dispositivos
        SET secret_hash = %s,
            secret_hash_anterior = COALESCE(secret_hash_anterior, secret_hash),
            rotacion_pendiente = false,
            secret_rotado_at = now()
        WHERE id = %s
        RETURNING id
        """,
        (secret_hash, dispositivo_id)
    )
    disp = cur.fetchone()
    if not disp:
        raise HTTPException(404, "Dispositivo no encontrado")
    return secret

def confirmar_rotacion(cur, dispositivo_id) -> None:
    # El dispositivo se autenticó con el secret nuevo: el viejo ya no hace falta
    cur.execute(
        "UPDATE dispositivos SET secret_hash_anterior = NULL WHERE id = %s",
        (dispositivo_id,)
    )

def marcar_rotacion_pendiente(cur, dispositivo_id) -> None:
    # Le avisa al dispositivo, en la respuesta de su próxima medición, que rote su secret
    cur.execute(
        """
        UPDATE dispositivos
        SET rotacion_pendiente = true
        WHERE id = %s
        RETURNING id
        """,
        (dispositivo_id,)
    )
    if not cur.fetchone():
        raise HTTPException(404, "Dispositivo no encontrado")

def actualizar_intervalo(cur, dispositivo_id, intervalo_seg) -> None:
    # intervalo_seg None = automático, usa el piso del plan vigente en cada momento
    cur.execute(
        "UPDATE dispositivos SET intervalo_configurado_seg = %s WHERE id = %s RETURNING id",
        (intervalo_seg, dispositivo_id)
    )
    if not cur.fetchone():
        raise HTTPException(404, "Dispositivo no encontrado")

def buscar_por_id_publico(cur, dispositivo_id) -> dict | None:
    # Busca un dispositivo por su id
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()

def buscar_por_id(cur, dispositivo_id) -> dict | None:
    cur.execute("SELECT * FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()

def buscar_por_usuario(cur, usuario_id) -> list[dict]:
    # Busca todos los dispositivos a los que está vinculado el usuario
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM dispositivos d JOIN usuario_dispositivo ud ON ud.dispositivo_id = d.id WHERE ud.usuario_id = %s", (usuario_id,))
    return cur.fetchall()

def actualizar_conexion(cur, dispositivo_id, timestamp) -> bool:
    # Actualiza las ultima conexión del dispositivo y si es su primera conexión
    cur.execute(
        """
        UPDATE dispositivos
        SET first_connected_at = COALESCE(first_connected_at, %s),
            last_seen_at = %s
        WHERE id = %s
        RETURNING id
        """,
        (timestamp, timestamp, dispositivo_id)
    )

def crear_vinculacion(cur, usuario_id, dispositivo_id, rol) -> dict:
    # Vincula un usuario con un dispositivo
    cur.execute(
        """
        INSERT INTO usuario_dispositivo (usuario_id, dispositivo_id, rol)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (usuario_id, dispositivo_id, rol)
    )
    return cur.fetchone()

def buscar_owner_de_dispositivo(cur, dispositivo_id) -> dict | None:
    # Busca el usuario dueño de un dispositivo
    cur.execute(
        """
        SELECT * from usuario_dispositivo
        WHERE dispositivo_id = %s AND rol = 'owner'
        """,
        (dispositivo_id,)
    )
    return cur.fetchone()