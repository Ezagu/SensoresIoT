from psycopg2.extras import execute_values

COLUMNAS = """
    id, sensor_id, creado_por, nombre, condicion, umbral, histeresis, activa,
    estado, estado_desde, ultimo_valor, ultima_evaluacion_at,
    ultima_notificacion_at, created_at
"""

def crear(cur, sensor_id, creado_por, nombre, condicion, umbral, histeresis) -> dict:
    cur.execute(
        f"""
        INSERT INTO alertas (sensor_id, creado_por, nombre, condicion, umbral, histeresis)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING {COLUMNAS}
        """,
        (sensor_id, creado_por, nombre, condicion, umbral, histeresis)
    )
    return cur.fetchone()

def buscar_por_id(cur, alerta_id) -> dict | None:
    cur.execute(f"SELECT {COLUMNAS} FROM alertas WHERE id = %s", (alerta_id,))
    return cur.fetchone()

def listar_por_dispositivo(cur, dispositivo_id) -> list[dict]:
    cur.execute(
        """
        SELECT a.id, a.sensor_id, a.creado_por, a.nombre, a.condicion, a.umbral,
               a.histeresis, a.activa, a.estado, a.estado_desde, a.ultimo_valor,
               a.ultima_evaluacion_at, a.ultima_notificacion_at, a.created_at
        FROM alertas a
        JOIN sensores s ON s.id = a.sensor_id
        WHERE s.dispositivo_id = %s
        ORDER BY a.created_at DESC
        """,
        (dispositivo_id,)
    )
    return cur.fetchall()

def disparadas_por_dispositivos(cur, dispositivo_ids: list) -> list[dict]:
    # Una sola query para lo que el panel necesita de alertas: el contador por
    # dispositivo y el ícono por sensor, ambos derivables de (dispositivo_id, sensor_id).
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

def actualizar(cur, alerta_id, nombre, umbral, histeresis, activa) -> dict | None:
    # Cambiar el umbral/histeresis resetea el estado a 'normal': la máquina
    # quedaría mintiendo si sigue en 'disparada' contra una condición distinta.
    cur.execute(
        f"""
        UPDATE alertas
        SET nombre = COALESCE(%s, nombre),
            umbral = COALESCE(%s, umbral),
            histeresis = COALESCE(%s, histeresis),
            activa = COALESCE(%s, activa),
            estado = 'normal',
            estado_desde = NULL
        WHERE id = %s
        RETURNING {COLUMNAS}
        """,
        (nombre, umbral, histeresis, activa, alerta_id)
    )
    return cur.fetchone()

def eliminar(cur, alerta_id) -> bool:
    cur.execute("DELETE FROM alertas WHERE id = %s RETURNING id", (alerta_id,))
    return cur.fetchone() is not None

def buscar_activas_por_sensores(cur, sensor_ids: list) -> list[dict]:
    # Trae el contexto que necesita el mail (dispositivo, tipo de sensor) en
    # una sola query. Los destinatarios se resuelven aparte (destinatarios_de_alerta):
    # una alerta ahora puede tener varios, no un usuario_id fijo.
    if not sensor_ids:
        return []

    cur.execute(
        f"""
        SELECT
            a.id, a.sensor_id, a.nombre, a.condicion, a.umbral,
            a.histeresis, a.estado, a.estado_desde, a.ultimo_valor,
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

def destinatarios_de_alerta(cur, alerta_id) -> list[dict]:
    # Todo el que tiene acceso al dispositivo (owner, editor, viewer), salvo
    # quien silenció ese equipo. La preferencia es del vínculo, no de la regla.
    cur.execute(
        """
        SELECT u.id, u.email, u.nombre
        FROM alertas a
        JOIN sensores s ON s.id = a.sensor_id
        JOIN usuario_dispositivo ud ON ud.dispositivo_id = s.dispositivo_id
        JOIN usuarios u ON u.id = ud.usuario_id
        WHERE a.id = %s AND ud.notificar
        """,
        (alerta_id,)
    )
    return cur.fetchall()

def actualizar_estado(cur, alerta_id, estado, estado_desde, ultimo_valor, ultima_evaluacion_at, notificada=False) -> None:
    if notificada:
        cur.execute(
            """
            UPDATE alertas
            SET estado = %s, estado_desde = %s, ultimo_valor = %s,
                ultima_evaluacion_at = %s, ultima_notificacion_at = now()
            WHERE id = %s
            """,
            (estado, estado_desde, ultimo_valor, ultima_evaluacion_at, alerta_id)
        )
    else:
        cur.execute(
            """
            UPDATE alertas
            SET estado = %s, estado_desde = %s, ultimo_valor = %s, ultima_evaluacion_at = %s
            WHERE id = %s
            """,
            (estado, estado_desde, ultimo_valor, ultima_evaluacion_at, alerta_id)
        )

def insertar_eventos(cur, eventos: list[tuple]) -> list[dict]:
    # (alerta_id, tipo, valor, medicion_at, detectado_at, tardio, destinatarios, notificados)
    # RETURNING id: el service necesita el id de la última transición de cada
    # regla para poder actualizar `notificados` recién con el resultado real del envío.
    if not eventos:
        return []
    return execute_values(
        cur,
        """
        INSERT INTO alerta_eventos (alerta_id, tipo, valor, medicion_at, detectado_at, tardio, destinatarios, notificados)
        VALUES %s
        RETURNING id
        """,
        eventos,
        fetch=True
    )

def actualizar_notificados(cur, evento_id, notificados: int) -> None:
    cur.execute("UPDATE alerta_eventos SET notificados = %s WHERE id = %s", (notificados, evento_id))

def actualizar_destinatarios(cur, evento_id, destinatarios: int) -> None:
    cur.execute("UPDATE alerta_eventos SET destinatarios = %s WHERE id = %s", (destinatarios, evento_id))

COLUMNAS_EVENTO_CON_CONTEXTO = """
    e.id, e.alerta_id, e.tipo, e.valor, e.medicion_at, e.detectado_at, e.tardio,
    e.destinatarios, e.notificados,
    a.nombre AS alerta_nombre, a.condicion, a.umbral,
    d.id AS dispositivo_id, d.nombre AS dispositivo_nombre,
    ts.nombre AS tipo_sensor_nombre, ts.unidad AS tipo_sensor_unidad
"""

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
        SELECT id, alerta_id, tipo, valor, medicion_at, detectado_at, tardio,
               destinatarios, notificados
        FROM alerta_eventos
        WHERE {condiciones}
        ORDER BY medicion_at DESC
        LIMIT %s
        """,
        params
    )
    return cur.fetchall()

def listar_eventos_por_dispositivo(cur, dispositivo_id, hasta, cursor, limite) -> list[dict]:
    condiciones = "s.dispositivo_id = %s"
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
        JOIN alertas a ON a.id = e.alerta_id
        JOIN sensores s ON s.id = a.sensor_id
        JOIN dispositivos d ON d.id = s.dispositivo_id
        JOIN tipos_sensor ts ON ts.id = s.tipo_sensor_id
        WHERE {condiciones}
        ORDER BY e.medicion_at DESC
        LIMIT %s
        """,
        params
    )
    return cur.fetchall()

def listar_eventos_por_usuario(cur, usuario_id, hasta, cursor, limite) -> list[dict]:
    # Log global: eventos de alertas de todos los dispositivos a los que el
    # usuario tiene acceso (cualquier rol), sin duplicar filas si en algún
    # momento tiene más de un vínculo con el mismo dispositivo.
    condiciones = "ud.usuario_id = %s"
    params = [usuario_id]

    tope = cursor if cursor is not None else hasta
    if tope:
        condiciones += " AND e.medicion_at < %s"
        params.append(tope)

    params.append(limite)

    cur.execute(
        f"""
        SELECT DISTINCT {COLUMNAS_EVENTO_CON_CONTEXTO}
        FROM alerta_eventos e
        JOIN alertas a ON a.id = e.alerta_id
        JOIN sensores s ON s.id = a.sensor_id
        JOIN dispositivos d ON d.id = s.dispositivo_id
        JOIN tipos_sensor ts ON ts.id = s.tipo_sensor_id
        JOIN usuario_dispositivo ud ON ud.dispositivo_id = d.id
        WHERE {condiciones}
        ORDER BY e.medicion_at DESC
        LIMIT %s
        """,
        params
    )
    return cur.fetchall()
