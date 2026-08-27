import psycopg2.errors
from fastapi import HTTPException
from core.security import generar_secret

COLUMNAS_PUBLICAS = "id, nombre, ubicacion, descripcion, activo, last_seen_at, first_connected_at"

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

def buscar_por_id(cur, dispositivo_id) -> dict | None:
    # Busca un dispositivo por su id
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM dispositivos WHERE id = %s", (dispositivo_id,))
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
    return cur.fetchone() is not None

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