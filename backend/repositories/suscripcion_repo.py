# Una suscripción está vigente sólo por fechas. `estado` no participa: guarda la
# intención ('cancelada' sigue vigente hasta fin_at porque el usuario pagó el
# período; 'revocada' viene siempre con fin_at = now()). Un único predicado
# temporal hace imposible olvidarse de un estado al escribir un gate nuevo.
# Todas las queries aliasan suscripciones como `s` para poder interpolarlo.
VIGENTE = "s.inicio_at <= now() AND (s.fin_at IS NULL OR s.fin_at > now())"

def buscar_vigente(cur, usuario_id) -> dict | None:
    # La suscripción vigente del usuario, o None si es free
    cur.execute(
        f"""
        SELECT s.* FROM suscripciones s
        WHERE s.usuario_id = %s AND {VIGENTE}
        ORDER BY s.inicio_at DESC
        LIMIT 1
        """,
        (usuario_id,)
    )
    return cur.fetchone()

def buscar_plan_vigente_por_usuario(cur, usuario_id) -> dict | None:
    # Devuelve la fila de planes del usuario, o None si no tiene suscripción vigente
    cur.execute(
        f"""
        SELECT p.* FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.usuario_id = %s AND {VIGENTE}
        ORDER BY s.inicio_at DESC
        LIMIT 1
        """,
        (usuario_id,)
    )
    return cur.fetchone()

def buscar_plan_vigente_por_dispositivo(cur, dispositivo_id) -> dict | None:
    # Los límites de datos de un dispositivo salen del plan de su owner, no del
    # usuario que consulta: un free con acceso compartido ve lo mismo que el owner.
    #
    # Una sola query en vez de componer buscar_owner_de_dispositivo + lookup del
    # plan: esto va a correr en el camino caliente de POST /mediciones/ cuando se
    # implemente el intervalo por plan, y dos round-trips por POST de cada placa
    # no se justifican para reusar dos líneas.
    cur.execute(
        f"""
        SELECT p.* FROM usuario_dispositivo ud
        JOIN suscripciones s ON s.usuario_id = ud.usuario_id AND {VIGENTE}
        JOIN planes p ON p.id = s.plan_id
        WHERE ud.dispositivo_id = %s AND ud.rol = 'owner'
        ORDER BY s.inicio_at DESC
        LIMIT 1
        """,
        (dispositivo_id,)
    )
    return cur.fetchone()

def listar_por_usuario(cur, usuario_id) -> list[dict]:
    # Historial completo, incluidas las revocadas y las ya vencidas
    cur.execute(
        "SELECT * FROM suscripciones WHERE usuario_id = %s ORDER BY inicio_at DESC",
        (usuario_id,)
    )
    return cur.fetchall()

def crear(cur, usuario_id, plan_id, fin_at, origen) -> dict:
    cur.execute(
        """
        INSERT INTO suscripciones (usuario_id, plan_id, fin_at, origen)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (usuario_id, plan_id, fin_at, origen)
    )
    return cur.fetchone()

def revocar_vigente(cur, usuario_id) -> dict | None:
    # Corte inmediato: fin_at = now() la saca del predicado de vigencia sin borrar
    # nada. Bajar de premium a free nunca borra datos ni vínculos.
    cur.execute(
        f"""
        UPDATE suscripciones AS s
        SET estado = 'revocada',
            fin_at = now()
        WHERE s.usuario_id = %s AND {VIGENTE}
        RETURNING s.*
        """,
        (usuario_id,)
    )
    return cur.fetchone()
