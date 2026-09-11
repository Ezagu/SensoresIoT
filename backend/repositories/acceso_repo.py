def buscar_rol_en_dispositivo(cur, dispositivo_id, usuario_id) -> str | None:
    cur.execute(
        "SELECT rol FROM usuario_dispositivo WHERE dispositivo_id = %s AND usuario_id = %s",
        (dispositivo_id, usuario_id)
    )
    fila = cur.fetchone()
    return fila["rol"] if fila else None

def buscar_notificar(cur, dispositivo_id, usuario_id) -> bool | None:
    # None = no hay vínculo (un admin mirando un equipo ajeno): tampoco es
    # destinatario, así que la preferencia no le aplica.
    cur.execute(
        "SELECT notificar FROM usuario_dispositivo WHERE dispositivo_id = %s AND usuario_id = %s",
        (dispositivo_id, usuario_id)
    )
    fila = cur.fetchone()
    return fila["notificar"] if fila else None

def actualizar_notificar(cur, dispositivo_id, usuario_id, notificar: bool) -> bool:
    cur.execute(
        """
        UPDATE usuario_dispositivo SET notificar = %s
        WHERE dispositivo_id = %s AND usuario_id = %s
        RETURNING notificar
        """,
        (notificar, dispositivo_id, usuario_id)
    )
    return cur.fetchone() is not None

def listar_accesos(cur, dispositivo_id):
    cur.execute(
        """
        SELECT ud.usuario_id, u.nombre, u.email, ud.rol, ud.created_at FROM usuario_dispositivo ud
        JOIN usuarios u ON u.id = ud.usuario_id
        WHERE ud.dispositivo_id = %s
        ORDER BY ud.created_at ASC
        """,
        (dispositivo_id,)
    )
    return cur.fetchall()

def eliminar_vinculacion(cur, dispositivo_id, usuario_id):
    cur.execute(
        """
        DELETE FROM usuario_dispositivo
        WHERE dispositivo_id = %s AND usuario_id = %s
        """,
        (dispositivo_id, usuario_id)
    )

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
