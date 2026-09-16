import psycopg2.errors
from fastapi import HTTPException
from core.security import generar_secret

COLUMNAS_PUBLICAS = ("id, nombre, ubicacion, descripcion, activo, last_seen_at, last_data_at, "
                     "first_connected_at, intervalo_configurado_seg, intervalo_modificado_at")
COLUMNAS_ACTUALIZABLES = ("nombre", "ubicacion", "descripcion", "activo")

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

def actualizar_intervalo(cur, dispositivo_id, intervalo_seg) -> None:
    # intervalo_seg None = automático, usa el piso del plan vigente en cada momento.
    # intervalo_modificado_at arranca la ventana en la que el equipo todavía no se
    # enteró y sigue publicando con el valor viejo.
    cur.execute(
        """
        UPDATE dispositivos
        SET intervalo_configurado_seg = %s, intervalo_modificado_at = now()
        WHERE id = %s
        RETURNING id
        """,
        (intervalo_seg, dispositivo_id)
    )
    if not cur.fetchone():
        raise HTTPException(404, "Dispositivo no encontrado")

def actualizar_conexion(cur, dispositivo_id, timestamp, con_datos: bool):
    # first_connected_at sólo se setea la primera vez (COALESCE).
    #
    # last_data_at sólo avanza si el POST traía lecturas: un heartbeat dice que el
    # equipo está vivo, no que sus sensores anden. Sin esa distinción, un equipo con
    # el bus I2C muerto se muestra "En línea" para siempre.
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

#-----------VIGILANCIA DE SILENCIO---------------

# Arbitraria pero fija: identifica al barrido, no a un dispositivo.
LOCK_VIGILANCIA = 4831001

def tomar_lock_vigilancia(cur) -> bool:
    # Versión _xact: se libera sola en el commit o el rollback, así que no hay
    # unlock que olvidar ni lock filtrado si la tarea se cancela en el medio.
    cur.execute("SELECT pg_try_advisory_xact_lock(%s) AS tomado", (LOCK_VIGILANCIA,))
    return cur.fetchone()["tomado"]

def candidatos_de_vigilancia(cur, ventana_sin_reportar_seg: int, ventana_arranque_seg: int) -> list[dict]:
    # Las dos piernas en una pasada, y el predicado completo: desde que la liveness
    # cuelga del heartbeat y no de la cadencia de publicación, el umbral es un
    # número fijo y el barrido no necesita resolver el plan de nadie.
    #
    # clock_timestamp() y no now(): now() es fijo por transacción, y dos equipos
    # detectados en el mismo barrido compartirían medicion_at al microsegundo, que
    # es justo lo que el cursor de paginación (medicion_at < %s, estricto) pierde
    # en el borde de página.
    cur.execute(
        """
        SELECT clock_timestamp() AS ahora,
               d.id, d.nombre, d.last_seen_at, d.sin_reportar_desde
        FROM dispositivos d
        WHERE d.activo
          AND d.last_seen_at IS NOT NULL
          AND (
                (d.sin_reportar_desde IS NULL
                 AND d.last_seen_at < now() - make_interval(secs => %s)
                 -- Durante el arranque no se abre nada: probar el equipo en el
                 -- banco y desenchufarlo para llevarlo al sitio no puede mandarle
                 -- al cliente "tu equipo nuevo dejó de reportar".
                 AND (d.first_connected_at IS NULL
                      OR now() - d.first_connected_at > make_interval(secs => %s)))
             OR (d.sin_reportar_desde IS NOT NULL AND d.last_seen_at > d.sin_reportar_desde)
          )
        """,
        (ventana_sin_reportar_seg, ventana_arranque_seg)
    )
    return cur.fetchall()

def abrir_sin_reportar(cur, dispositivo_id, last_seen_at) -> bool:
    # El RETURNING es el permiso para mandar el mail, no el SELECT del barrido.
    # `last_seen_at = %s` es concurrencia optimista: si el equipo posteó entre el
    # SELECT y esto, no hay caída y no sale nada. Sin esa condición, un POST que
    # entra justo pasada la ventana produce un "dejó de reportar" de un equipo que
    # acaba de volver, y un "volvió a reportar" 60 s después.
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

def limpiar_sin_reportar(cur, dispositivo_id) -> None:
    # Desactivar un equipo es "dejo de vigilarlo": sin esto, la caída queda
    # abierta para siempre (un equipo inactivo no puede postear) y el día que lo
    # reactiven sale un "volvió a reportar" de un corte que fue una decisión.
    cur.execute(
        "UPDATE dispositivos SET sin_reportar_desde = NULL WHERE id = %s",
        (dispositivo_id,)
    )

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