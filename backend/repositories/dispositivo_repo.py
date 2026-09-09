import psycopg2.errors
from fastapi import HTTPException
from core.security import generar_secret

COLUMNAS_PUBLICAS = "id, nombre, ubicacion, descripcion, activo, last_seen_at, first_connected_at, intervalo_configurado_seg"
COLUMNAS_ACTUALIZABLES = ("nombre", "ubicacion", "descripcion", "activo")

def buscar_rol_en_dispositivo(cur, dispositivo_id, usuario_id) -> str | None:
    cur.execute(
        "SELECT rol FROM usuario_dispositivo WHERE dispositivo_id = %s AND usuario_id = %s",
        (dispositivo_id, usuario_id)
    )
    fila = cur.fetchone()
    return fila["rol"] if fila else None

def crear(cur, nombre: str, ubicacion: str, descripcion: str) -> dict:
    # El secret sólo sale en texto plano acá; se persiste únicamente el hash.
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

def actualizar(cur, dispositivo_id, campos: dict) -> dict:
    sets = []
    valores = []

    for columna in COLUMNAS_ACTUALIZABLES:
        if columna in campos:
            sets.append(f"{columna} = %s")
            valores.append(campos[columna])

    if not sets:
        return None

    valores.append(dispositivo_id)

    cur.execute(
        f"UPDATE dispositivos SET {', '.join(sets)} WHERE id = %s RETURNING {COLUMNAS_PUBLICAS}",
        tuple(valores),
    )
    return cur.fetchone()

def buscar_por_id_publico(cur, dispositivo_id) -> dict | None:
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()

def buscar_por_id(cur, dispositivo_id) -> dict | None:
    cur.execute("SELECT * FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()

def buscar_por_usuario(cur, usuario_id) -> list[dict]:
    # Devuelve tambien el rol del vinculo: es lo unico que distingue un
    # dispositivo propio de uno que le compartieron a este usuario.
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS}, ud.rol FROM dispositivos d JOIN usuario_dispositivo ud ON ud.dispositivo_id = d.id WHERE ud.usuario_id = %s", (usuario_id,))
    return cur.fetchall()

def listar_accesos(cur, dispositivo_id):
    cur.execute(
        f"""
        SELECT ud.usuario_id, u.nombre, u.email, ud.rol, ud.created_at FROM usuario_dispositivo ud
        JOIN usuarios u ON u.id = ud.usuario_id
        WHERE ud.dispositivo_id = %s
        ORDER BY ud.created_at ASC
        """,
        (dispositivo_id,)
    )
    return cur.fetchall()

def cambiar_rol(cur, dispositivo_id, usuarios_id, rol) -> dict:
    cur.execute(
        """
        UPDATE usuario_dispositivo ud
        SET rol = %s
        FROM usuarios u
        WHERE ud.dispositivo_id = %s 
            AND ud.usuario_id = %s
            AND u.id = ud.usuario_id
        RETURNING ud.usuario_id, u.nombre, u.email, ud.rol, ud.created_at
        """, 
        (rol, dispositivo_id, usuarios_id)
    )
    return cur.fetchone()

def actualizar_intervalo(cur, dispositivo_id, intervalo_seg) -> None:
    # intervalo_seg None = automático, usa el piso del plan vigente en cada momento
    cur.execute(
        "UPDATE dispositivos SET intervalo_configurado_seg = %s WHERE id = %s RETURNING id",
        (intervalo_seg, dispositivo_id)
    )
    if not cur.fetchone():
        raise HTTPException(404, "Dispositivo no encontrado")

def actualizar_conexion(cur, dispositivo_id, timestamp) -> bool:
    # first_connected_at sólo se setea la primera vez (COALESCE).
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
    cur.execute(
        """
        SELECT * from usuario_dispositivo
        WHERE dispositivo_id = %s AND rol = 'owner'
        """,
        (dispositivo_id,)
    )
    return cur.fetchone()

def buscar_nombre_owner(cur, dispositivo_id) -> str | None:
    cur.execute(
        """
        SELECT u.nombre FROM usuario_dispositivo ud
        JOIN usuarios u ON u.id = ud.usuario_id
        WHERE ud.dispositivo_id = %s AND ud.rol = 'owner'
        """,
        (dispositivo_id,)
    )
    fila = cur.fetchone()
    return fila["nombre"] if fila else None

#-----------SECRET---------------

def actualizar_secret(cur, dispositivo_id) -> str:
    # Uso de banco/fábrica: requiere reflashear el equipo con el secret devuelto.
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
    # El secret viejo pasa a secret_hash_anterior y sigue válido hasta que el
    # dispositivo confirme el nuevo. COALESCE evita pisarlo si ya había una
    # rotación sin confirmar: siempre se conserva el último secret confirmado,
    # nunca el intermedio que el equipo pudo no haber recibido.
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
    cur.execute(
        "UPDATE dispositivos SET secret_hash_anterior = NULL WHERE id = %s",
        (dispositivo_id,)
    )

def marcar_rotacion_pendiente(cur, dispositivo_id) -> None:
    # El aviso llega al dispositivo en la respuesta de su próxima medición.
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