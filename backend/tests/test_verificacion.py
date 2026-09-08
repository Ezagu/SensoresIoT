from datetime import timedelta

from tests.utilidades import crear_token_verificacion, crear_usuario, fila_usuario


def verificar(cliente, token):
    return cliente.post("/auth/verify-email", json={"token": token})


def test_token_valido_verifica_la_cuenta(cliente, usuario_sin_verificar):
    token = crear_token_verificacion(usuario_sin_verificar["id"])

    respuesta = verificar(cliente, token)

    assert respuesta.status_code == 200
    assert fila_usuario(usuario_sin_verificar["email"])["is_verified"] is True


def test_token_inexistente_devuelve_400(cliente, usuario_sin_verificar):
    respuesta = verificar(cliente, "token-que-no-existe")

    assert respuesta.status_code == 400
    assert fila_usuario(usuario_sin_verificar["email"])["is_verified"] is False


def test_token_ya_usado_devuelve_400_y_la_cuenta_sigue_verificada(cliente, usuario_sin_verificar):
    token = crear_token_verificacion(usuario_sin_verificar["id"])
    verificar(cliente, token)

    respuesta = verificar(cliente, token)

    assert respuesta.status_code == 400
    assert fila_usuario(usuario_sin_verificar["email"])["is_verified"] is True


def test_token_expirado_devuelve_400_y_no_verifica_la_cuenta(cliente, usuario_sin_verificar):
    token = crear_token_verificacion(usuario_sin_verificar["id"], vence_en=timedelta(hours=-1))

    respuesta = verificar(cliente, token)

    assert respuesta.status_code == 400
    assert fila_usuario(usuario_sin_verificar["email"])["is_verified"] is False


def test_un_token_expirado_no_sirve_en_un_segundo_intento(cliente, usuario_sin_verificar):
    # Regresión del rollback silencioso: si el endpoint consume el token y
    # después levanta el 400, el borrado se pierde y el token revive.
    token = crear_token_verificacion(usuario_sin_verificar["id"], vence_en=timedelta(hours=-1))
    verificar(cliente, token)

    assert verificar(cliente, token).status_code == 400
    assert fila_usuario(usuario_sin_verificar["email"])["is_verified"] is False


def test_el_token_de_un_usuario_no_verifica_a_otro(cliente, usuario_sin_verificar):
    otro = crear_usuario("otro-sin-verificar@test.com", verificado=False)
    token = crear_token_verificacion(usuario_sin_verificar["id"])

    verificar(cliente, token)

    assert fila_usuario(otro["email"])["is_verified"] is False
