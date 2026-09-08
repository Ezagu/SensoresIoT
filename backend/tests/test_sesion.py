from tests.utilidades import autorizacion, con_cookie, conexion, cookie_refresh, loguear, refresh_tokens_de


def refrescar(cliente, token=None):
    return con_cookie(cliente, "/auth/refresh", token)


def revocar_en_db(token_hash):
    with conexion() as cur:
        cur.execute(
            "UPDATE refresh_token SET revocado = true, revocado_at = now() WHERE token_hash = %s",
            (token_hash,),
        )


def test_refresh_con_token_valido_devuelve_access_y_refresh_nuevos(cliente, usuario_verificado):
    inicial = cookie_refresh(loguear(cliente, usuario_verificado["email"]))

    respuesta = refrescar(cliente, inicial)

    assert respuesta.status_code == 200
    assert respuesta.json()["access_token"]
    assert cookie_refresh(respuesta) not in (None, inicial)


def test_el_refresh_token_viejo_queda_invalido_despues_de_rotar(cliente, usuario_verificado):
    inicial = cookie_refresh(loguear(cliente, usuario_verificado["email"]))
    refrescar(cliente, inicial)

    assert refrescar(cliente, inicial).status_code == 401


def test_refresh_con_token_revocado_devuelve_401(cliente, usuario_verificado):
    from core.security import hashear_sha256

    token = cookie_refresh(loguear(cliente, usuario_verificado["email"]))
    revocar_en_db(hashear_sha256(token))

    assert refrescar(cliente, token).status_code == 401


def test_refresh_con_token_inexistente_o_malformado_devuelve_401(cliente, usuario_verificado):
    loguear(cliente, usuario_verificado["email"])

    assert refrescar(cliente, "no-es-un-token").status_code == 401


def test_refresh_sin_cookie_devuelve_401(cliente, usuario_verificado):
    loguear(cliente, usuario_verificado["email"])

    assert refrescar(cliente).status_code == 401


def test_logout_revoca_solo_la_sesion_actual(cliente, usuario_verificado):
    primera = cookie_refresh(loguear(cliente, usuario_verificado["email"]))
    segunda = cookie_refresh(loguear(cliente, usuario_verificado["email"]))

    assert con_cookie(cliente, "/auth/logout", primera).status_code == 200
    assert refrescar(cliente, primera).status_code == 401
    assert refrescar(cliente, segunda).status_code == 200


def test_logout_marca_revocado_ese_refresh_token_en_la_db(cliente, usuario_verificado):
    from core.security import hashear_sha256

    token = cookie_refresh(loguear(cliente, usuario_verificado["email"]))

    con_cookie(cliente, "/auth/logout", token)

    guardado = next(
        t for t in refresh_tokens_de(usuario_verificado["id"])
        if t["token_hash"] == hashear_sha256(token)
    )
    assert guardado["revocado"] is True


def test_logout_global_revoca_todas_las_sesiones_del_usuario(cliente, usuario_verificado):
    primera = loguear(cliente, usuario_verificado["email"])
    segunda = loguear(cliente, usuario_verificado["email"])
    tercera = loguear(cliente, usuario_verificado["email"])
    access = tercera.json()["access_token"]

    respuesta = cliente.post("/auth/global-logout", headers=autorizacion(access))

    assert respuesta.status_code == 200
    assert all(t["revocado"] for t in refresh_tokens_de(usuario_verificado["id"]))
    for sesion in (primera, segunda, tercera):
        assert refrescar(cliente, cookie_refresh(sesion)).status_code == 401


def test_logout_global_no_toca_las_sesiones_de_otro_usuario(cliente, usuario_verificado):
    from tests.utilidades import crear_usuario

    otro = crear_usuario("otro-sesion@test.com", verificado=True)
    ajena = cookie_refresh(loguear(cliente, otro["email"]))
    propia = loguear(cliente, usuario_verificado["email"])

    cliente.post("/auth/global-logout", headers=autorizacion(propia.json()["access_token"]))

    assert refrescar(cliente, ajena).status_code == 200
