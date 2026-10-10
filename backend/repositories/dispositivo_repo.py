COLUMNAS_PUBLICAS = ("id, nombre, ubicacion, last_seen_at, last_data_at, "
                    "first_connected_at, intervalo_configurado_seg, intervalo_modificado_at, "
                    "tiene_bateria, bateria_mv, bateria_at")
COLUMNAS_ACTUALIZABLES = ("nombre", "ubicacion")

def crear(cur, nombre: str, ubicacion: str, secret_hash: str) -> dict:
    cur.execute(
        f"""
        INSERT INTO dispositivos (nombre, ubicacion, secret_hash)
        VALUES (%s, %s, %s)
        RETURNING {COLUMNAS_PUBLICAS}
        """,
        (nombre, ubicacion, secret_hash)
    )
    return cur.fetchone()

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

def buscar_por_id(cur, dispositivo_id) -> dict | None:
    cur.execute("SELECT * FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()

def buscar_por_id_publico(cur, dispositivo_id) -> dict | None:
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS} FROM dispositivos WHERE id = %s", (dispositivo_id,))
    return cur.fetchone()

def buscar_por_usuario(cur, usuario_id) -> list[dict]:
    # Devuelve tambien el rol del vinculo: es lo unico que distingue un
    # dispositivo propio de uno que le compartieron a este usuario.
    cur.execute(f"SELECT {COLUMNAS_PUBLICAS}, ud.rol FROM dispositivos d JOIN usuario_dispositivo ud ON ud.dispositivo_id = d.id WHERE ud.usuario_id = %s", (usuario_id,))
    return cur.fetchall()

def actualizar_intervalo(cur, dispositivo_id, intervalo_seg) -> None:
    # intervalo_seg None = automático, usa el piso del plan vigente en cada momento.
    # intervalo_modificado_at arranca la ventana en la que el equipo todavía no se
    # enteró y sigue publicando con el valor viejo.
    cur.execute(
        """
        UPDATE dispositivos
        SET intervalo_configurado_seg = %s, intervalo_modificado_at = now()
        WHERE id = %s
        """,
        (intervalo_seg, dispositivo_id)
    )

def actualizar_conexion(cur, dispositivo_id, timestamp, con_datos: bool):
    # first_connected_at sólo se setea la primera vez (COALESCE).
    # last_data_at sólo avanza si el POST traía lecturas: un heartbeat dice que el
    # equipo está vivo, no que sus sensores anden.
    cur.execute(
        f"""
        UPDATE dispositivos
        SET first_connected_at = COALESCE(first_connected_at, %s),
            last_seen_at = %s
            {", last_data_at = %s" if con_datos else ""}
        WHERE id = %s
        RETURNING id
        """,
        (timestamp, timestamp, timestamp, dispositivo_id) if con_datos
        else (timestamp, timestamp, dispositivo_id)
    )

def actualizar_bateria(cur, dispositivo_id, bateria_mv: int, timestamp):
    cur.execute(
        """
        UPDATE dispositivos
        SET bateria_mv = %s, bateria_at = %s
        WHERE id = %s
        """,
        (bateria_mv, timestamp, dispositivo_id)
    )

#-----------VIGILANCIA DE SILENCIO---------------

def candidatos_de_vigilancia(cur, ventana_sin_reportar_seg: int) -> list[dict]:
    # Equipos cuyo latch no coincide con su estado: callados sin caída abierta
    # (abrir) o con caída abierta que volvieron a hablar (cerrar).
    # clock_timestamp() devuelve la hora en cada fila, no la misma para todas.
    cur.execute(
        """
        SELECT clock_timestamp() AS ahora, d.id, d.nombre, d.last_seen_at, d.sin_reportar_desde
        FROM dispositivos d
        WHERE d.last_seen_at IS NOT NULL
        AND
            ((d.sin_reportar_desde IS NULL AND d.last_seen_at < now() - make_interval(secs => %s))
            OR (d.sin_reportar_desde IS NOT NULL AND d.last_seen_at > d.sin_reportar_desde))
        """,
        (ventana_sin_reportar_seg,)
    )
    return cur.fetchall()

def abrir_sin_reportar(cur, dispositivo_id, last_seen_at) -> bool:
    # El RETURNING es el permiso para mandar el mail, no el SELECT del barrido.
    # `last_seen_at = %s` evita condición de carrera
    cur.execute(
        """
        UPDATE dispositivos SET sin_reportar_desde = %s
        WHERE id = %s AND sin_reportar_desde IS NULL AND last_seen_at = %s
        RETURNING id
        """,
        (last_seen_at, dispositivo_id, last_seen_at)
    )
    return cur.fetchone() is not None

def cerrar_sin_reportar(cur, dispositivo_id, sin_reportar_desde) -> bool:
    cur.execute(
        """
        UPDATE dispositivos SET sin_reportar_desde = NULL
        WHERE id = %s AND sin_reportar_desde = %s
        RETURNING id
        """,
        (dispositivo_id, sin_reportar_desde)
    )
    return cur.fetchone() is not None

#-----------SECRET---------------

def actualizar_secret(cur, dispositivo_id, secret_hash: str) -> bool:
    cur.execute(
        """
        UPDATE dispositivos
        SET secret_hash = %s
        WHERE id = %s
        RETURNING id
        """,
        (secret_hash, dispositivo_id)
    )
    return cur.fetchone() is not None

def rotar_secret(cur, dispositivo_id, secret_hash: str) -> bool:
    # El secret viejo pasa a secret_hash_anterior y sigue válido hasta que el
    # dispositivo confirme el nuevo. COALESCE evita pisarlo si ya había una
    # rotación sin confirmar: siempre se conserva el último secret confirmado,
    # nunca el intermedio que el equipo pudo no haber recibido.
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
    return cur.fetchone() is not None

def confirmar_rotacion(cur, dispositivo_id) -> None:
    cur.execute(
        "UPDATE dispositivos SET secret_hash_anterior = NULL WHERE id = %s",
        (dispositivo_id,)
    )

def marcar_rotacion_pendiente(cur, dispositivo_id) -> bool:
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
    return cur.fetchone() is not None
