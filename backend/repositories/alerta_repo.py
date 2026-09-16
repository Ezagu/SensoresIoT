from psycopg2.extras import execute_values

COLUMNAS = """
    id, sensor_id, creado_por, nombre, condicion, umbral, histeresis,
    muestras_confirmacion, activa, estado, estado_desde, ultimo_valor,
    ultima_evaluacion_at, ultima_notificacion_at, created_at
"""

def crear(cur, sensor_id, creado_por, nombre, condicion, umbral, histeresis, muestras_confirmacion) -> dict:
    cur.execute(
        f"""
        INSERT INTO alertas (sensor_id, creado_por, nombre, condicion, umbral, histeresis, muestras_confirmacion)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING {COLUMNAS}
        """,
        (sensor_id, creado_por, nombre, condicion, umbral, histeresis, muestras_confirmacion)
    )
    return cur.fetchone()

def buscar_por_id(cur, alerta_id) -> dict | None:
    cur.execute(f"SELECT {COLUMNAS} FROM alertas WHERE id = %s", (alerta_id,))
    return cur.fetchone()

def listar_por_dispositivo(cur, dispositivo_id) -> list[dict]:
    cur.execute(
        """
        SELECT a.id, a.sensor_id, a.creado_por, a.nombre, a.condicion, a.umbral,
            a.histeresis, a.muestras_confirmacion, a.activa, a.estado,
            a.estado_desde, a.ultimo_valor, a.ultima_evaluacion_at,
            a.ultima_notificacion_at, a.created_at
        FROM alertas a
        JOIN sensores s ON s.id = a.sensor_id
        WHERE s.dispositivo_id = %s
        ORDER BY a.created_at DESC
        """,
        (dispositivo_id,)
    )
    return cur.fetchall()

def disparadas_por_dispositivos(cur, dispositivo_ids: list) -> list[dict]:
    # Una fila por alerta disparada: el contador por dispositivo (panel y detalle)
    # y el ícono por sensor salen los dos de (dispositivo_id, sensor_id).
    if not dispositivo_ids:
        return []
    cur.execute(
        """
        SELECT s.dispositivo_id, a.sensor_id
        FROM alertas a
        JOIN sensores s ON s.id = a.sensor_id
        WHERE s.dispositivo_id = ANY(%s) AND a.activa AND a.estado = 'disparada'
        """,
        (dispositivo_ids,)
    )
    return cur.fetchall()

def contar_por_dispositivo(cur, dispositivo_id) -> int:
    cur.execute(
        """
        SELECT count(*) AS total FROM alertas a
        JOIN sensores s ON s.id = a.sensor_id
        WHERE s.dispositivo_id = %s
        """,
        (dispositivo_id,)
    )
    return cur.fetchone()["total"]

def actualizar(cur, alerta_id, nombre, umbral, histeresis, activa, muestras_confirmacion) -> dict | None:
    # Cambiar el umbral/histeresis resetea el estado a 'normal': la máquina
    # quedaría mintiendo si sigue en 'disparada' contra una condición distinta.
    # El contador de cruces acompaña: venía contando contra la condición vieja.
    cur.execute(
        f"""
        UPDATE alertas
        SET nombre = COALESCE(%s, nombre),
            umbral = COALESCE(%s, umbral),
            histeresis = COALESCE(%s, histeresis),
            activa = COALESCE(%s, activa),
            muestras_confirmacion = COALESCE(%s, muestras_confirmacion),
            estado = 'normal',
            estado_desde = NULL,
            cruces_consecutivos = 0
        WHERE id = %s
        RETURNING {COLUMNAS}
        """,
        (nombre, umbral, histeresis, activa, muestras_confirmacion, alerta_id)
    )
    return cur.fetchone()

def eliminar(cur, alerta_id) -> bool:
    cur.execute("DELETE FROM alertas WHERE id = %s RETURNING id", (alerta_id,))
    return cur.fetchone() is not None

def buscar_activas_por_sensores(cur, sensor_ids: list) -> list[dict]:
    # Trae el contexto que necesita el mail (dispositivo, tipo de sensor) en
    # una sola query. Los destinatarios se resuelven aparte (acceso_repo.destinatarios)
    if not sensor_ids:
        return []

    cur.execute(
        f"""
        SELECT
            a.id, a.sensor_id, a.nombre, a.condicion, a.umbral,
            a.histeresis, a.muestras_confirmacion, a.cruces_consecutivos,
            a.estado, a.estado_desde, a.ultimo_valor,
            a.ultima_evaluacion_at, a.ultima_notificacion_at,
            d.id AS dispositivo_id, d.nombre AS dispositivo_nombre,
            ts.nombre AS tipo_sensor_nombre, ts.unidad AS tipo_sensor_unidad
        FROM alertas a
        JOIN sensores s ON s.id = a.sensor_id
        JOIN dispositivos d ON d.id = s.dispositivo_id
        JOIN tipos_sensor ts ON ts.id = s.tipo_sensor_id
        WHERE a.activa AND a.sensor_id = ANY(%s)
        """,
        (sensor_ids,)
    )
    return cur.fetchall()

def actualizar_estado(cur, alerta_id, estado, estado_desde, ultimo_valor,
                      ultima_evaluacion_at, cruces_consecutivos, notificada=False) -> None:
    cur.execute(
        f"""
        UPDATE alertas
        SET estado = %s, estado_desde = %s, ultimo_valor = %s,
            ultima_evaluacion_at = %s, cruces_consecutivos = %s
            {", ultima_notificacion_at = now()" if notificada else ""}
        WHERE id = %s
        """,
        (estado, estado_desde, ultimo_valor, ultima_evaluacion_at, cruces_consecutivos, alerta_id)
    )

def umbrales_por_dispositivo(cur, dispositivo_id) -> list[dict]:
    # Lo mínimo para que el equipo decida si adelanta un envío; no es la regla
    # completa. La máquina de estados y la notificación viven en el servidor.
    cur.execute(
        """
        SELECT a.sensor_id, a.condicion, a.umbral, a.histeresis, a.muestras_confirmacion
        FROM alertas a
        JOIN sensores s ON s.id = a.sensor_id
        WHERE s.dispositivo_id = %s AND a.activa
        ORDER BY a.created_at
        """,
        (dispositivo_id,)
    )
    return cur.fetchall()

def insertar_eventos(cur, eventos: list[tuple]) -> list[dict]:
    # (dispositivo_id, alerta_id, tipo, valor, medicion_at, detectado_at, tardio,
    #  alerta_nombre, condicion, umbral, tipo_sensor_nombre, tipo_sensor_unidad)
    # El snapshot de la regla viaja con el evento: editarla después no puede
    # reescribir lo que decía cuando pasó.
    # RETURNING id: el service necesita el id de la última transición de cada
    # regla para poder actualizar `notificados` recién con el resultado real del envío.
    if not eventos:
        return []
    return execute_values(
        cur,
        """
        INSERT INTO alerta_eventos (
            dispositivo_id, alerta_id, tipo, valor, medicion_at, detectado_at, tardio,
            alerta_nombre, condicion, umbral, tipo_sensor_nombre, tipo_sensor_unidad
        )
        VALUES %s
        RETURNING id
        """,
        eventos,
        fetch=True
    )

def insertar_eventos_de_conectividad(cur, eventos: list[tuple]) -> list[dict]:
    # (dispositivo_id, tipo, medicion_at, detectado_at, silencio_desde)
    # Función aparte y no un insertar_eventos con media tupla en NULL: son dos
    # formas distintas y cada una escribe sus propias columnas.
    # Devuelve dispositivo_id junto al id para no depender del orden de VALUES.
    if not eventos:
        return []
    return execute_values(
        cur,
        """
        INSERT INTO alerta_eventos (dispositivo_id, tipo, medicion_at, detectado_at, silencio_desde)
        VALUES %s
        RETURNING id, dispositivo_id
        """,
        eventos,
        fetch=True
    )

def actualizar_notificados(cur, evento_id, notificados: int) -> None:
    cur.execute("UPDATE alerta_eventos SET notificados = %s WHERE id = %s", (notificados, evento_id))

def actualizar_destinatarios(cur, evento_id, destinatarios: int) -> None:
    cur.execute("UPDATE alerta_eventos SET destinatarios = %s WHERE id = %s", (destinatarios, evento_id))

COLUMNAS_EVENTO = """
    e.id, e.dispositivo_id, e.alerta_id, e.tipo, e.valor, e.medicion_at,
    e.detectado_at, e.tardio, e.destinatarios, e.notificados,
    e.alerta_nombre, e.condicion, e.umbral,
    e.tipo_sensor_nombre, e.tipo_sensor_unidad, e.silencio_desde
"""

# El único JOIN que queda. El nombre del equipo se lee VIVO a propósito: es el
# mismo objeto físico y lo querés encontrar por su nombre de hoy. El umbral, en
# cambio, es un parámetro de un hecho pasado y por eso va en el snapshot.
COLUMNAS_EVENTO_CON_CONTEXTO = f"{COLUMNAS_EVENTO}, d.nombre AS dispositivo_nombre"

def listar_eventos_por_alerta(cur, alerta_id, hasta, cursor, limite) -> list[dict]:
    condiciones = "alerta_id = %s"
    params = [alerta_id]

    tope = cursor if cursor is not None else hasta
    if tope:
        condiciones += " AND medicion_at < %s"
        params.append(tope)

    params.append(limite)

    cur.execute(
        f"""
        SELECT id, dispositivo_id, alerta_id, tipo, valor, medicion_at, detectado_at,
               tardio, destinatarios, notificados
        FROM alerta_eventos
        WHERE {condiciones}
        ORDER BY medicion_at DESC
        LIMIT %s
        """,
        params
    )
    return cur.fetchall()

def listar_eventos_por_dispositivo(cur, dispositivo_id, hasta, cursor, limite) -> list[dict]:
    condiciones = "e.dispositivo_id = %s"
    params = [dispositivo_id]

    tope = cursor if cursor is not None else hasta
    if tope:
        condiciones += " AND e.medicion_at < %s"
        params.append(tope)

    params.append(limite)

    cur.execute(
        f"""
        SELECT {COLUMNAS_EVENTO_CON_CONTEXTO}
        FROM alerta_eventos e
        JOIN dispositivos d ON d.id = e.dispositivo_id
        WHERE {condiciones}
        ORDER BY e.medicion_at DESC
        LIMIT %s
        """,
        params
    )
    return cur.fetchall()

def listar_eventos_por_usuario(cur, usuario_id, hasta, cursor, limite) -> list[dict]:
    # Log global: todo lo que pasó en los dispositivos a los que el usuario llega
    # (cualquier rol), sean transiciones de umbral o cortes de conectividad. Sin
    # DISTINCT: la PK de usuario_dispositivo garantiza una fila por par.
    condiciones = "ud.usuario_id = %s"
    params = [usuario_id]

    tope = cursor if cursor is not None else hasta
    if tope:
        condiciones += " AND e.medicion_at < %s"
        params.append(tope)

    params.append(limite)

    cur.execute(
        f"""
        SELECT {COLUMNAS_EVENTO_CON_CONTEXTO}
        FROM alerta_eventos e
        JOIN dispositivos d ON d.id = e.dispositivo_id
        JOIN usuario_dispositivo ud ON ud.dispositivo_id = e.dispositivo_id
        WHERE {condiciones}
        ORDER BY e.medicion_at DESC
        LIMIT %s
        """,
        params
    )
    return cur.fetchall()
