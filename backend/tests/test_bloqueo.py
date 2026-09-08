from datetime import datetime, timedelta, timezone

from tests.utilidades import conexion, crear_usuario, fila_usuario, loguear, refresh_tokens_de

INCORRECTA = "Incorrecta123!"


def bloquear(email, *, hasta):
    with conexion() as cur:
        cur.execute(
            "UPDATE usuarios SET intentos_fallidos = 5, bloqueado_hasta = %s WHERE email = %s",
            (hasta, email),
        )


def test_un_intento_fallido_queda_commiteado_en_la_db(cliente, usuario_verificado):
    # Regresión del rollback silencioso: el write ocurre antes del HTTPException 401.
    loguear(cliente, usuario_verificado["email"], INCORRECTA)

    assert fila_usuario(usuario_verificado["email"])["intentos_fallidos"] == 1


def test_cuatro_fallidos_y_despues_password_correcto_loguea_y_resetea_el_contador(
    cliente, usuario_verificado
):
    for _ in range(4):
        loguear(cliente, usuario_verificado["email"], INCORRECTA)

    respuesta = loguear(cliente, usuario_verificado["email"])

    assert respuesta.status_code == 200
    usuario = fila_usuario(usuario_verificado["email"])
    assert usuario["intentos_fallidos"] == 0
    assert usuario["bloqueado_hasta"] is None


def test_el_quinto_intento_fallido_bloquea_la_cuenta(cliente, usuario_verificado):
    codigos = [loguear(cliente, usuario_verificado["email"], INCORRECTA).status_code for _ in range(5)]

    assert codigos == [401] * 5
    usuario = fila_usuario(usuario_verificado["email"])
    assert usuario["bloqueado_hasta"] is not None
    assert usuario["bloqueado_hasta"] > datetime.now(timezone.utc)


def test_el_bloqueo_dura_quince_minutos(cliente, usuario_verificado):
    for _ in range(5):
        loguear(cliente, usuario_verificado["email"], INCORRECTA)

    bloqueado_hasta = fila_usuario(usuario_verificado["email"])["bloqueado_hasta"]
    restante = bloqueado_hasta - datetime.now(timezone.utc)
    assert timedelta(minutes=14) < restante <= timedelta(minutes=15)


def test_password_correcto_con_la_cuenta_bloqueada_no_loguea(cliente, usuario_verificado):
    hasta = datetime.now(timezone.utc) + timedelta(minutes=10)
    bloquear(usuario_verificado["email"], hasta=hasta)

    respuesta = loguear(cliente, usuario_verificado["email"])

    assert respuesta.status_code == 401
    assert "access_token" not in respuesta.json()
    assert refresh_tokens_de(usuario_verificado["id"]) == []


def test_password_correcto_con_la_cuenta_bloqueada_no_extiende_el_bloqueo(
    cliente, usuario_verificado
):
    hasta = datetime.now(timezone.utc) + timedelta(minutes=10)
    bloquear(usuario_verificado["email"], hasta=hasta)

    loguear(cliente, usuario_verificado["email"])

    assert fila_usuario(usuario_verificado["email"])["bloqueado_hasta"] == hasta


def test_password_incorrecto_con_la_cuenta_bloqueada_devuelve_401(cliente, usuario_verificado):
    bloquear(usuario_verificado["email"], hasta=datetime.now(timezone.utc) + timedelta(minutes=10))

    assert loguear(cliente, usuario_verificado["email"], INCORRECTA).status_code == 401


def test_password_correcto_con_el_bloqueo_ya_vencido_loguea_y_resetea_el_contador(
    cliente, usuario_verificado
):
    bloquear(usuario_verificado["email"], hasta=datetime.now(timezone.utc) - timedelta(minutes=1))

    respuesta = loguear(cliente, usuario_verificado["email"])

    assert respuesta.status_code == 200
    usuario = fila_usuario(usuario_verificado["email"])
    assert usuario["intentos_fallidos"] == 0


def test_el_bloqueo_es_por_cuenta_y_no_afecta_a_otra(cliente, usuario_verificado):
    otro = crear_usuario("otro@test.com", verificado=True)
    for _ in range(5):
        loguear(cliente, usuario_verificado["email"], INCORRECTA)

    assert loguear(cliente, otro["email"]).status_code == 200
