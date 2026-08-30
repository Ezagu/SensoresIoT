# Vigencia sólo por fechas; `estado` guarda intención pero no participa acá
# ('cancelada' sigue vigente hasta fin_at, 'revocada' ya viene con fin_at = now()).
# Todas las queries aliasan suscripciones como `s` para poder interpolarlo.
VIGENTE = "s.inicio_at <= now() AND (s.fin_at IS NULL OR s.fin_at > now())"

def buscar_vigente(cur, usuario_id) -> dict | None:
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
    # Una sola query (no buscar_owner_de_dispositivo + lookup aparte): corre en
    # el camino caliente de POST /mediciones/, no se justifican dos round-trips.
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
