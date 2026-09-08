import os

import jwt
import pytest

from tests.utilidades import (
    PASSWORD_VALIDA,
    cookies_de,
    cookie_refresh,
    crear_usuario,
    loguear,
    refresh_tokens_de,
)


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({}, id="body_vacio"),
        pytest.param({"email": "alguien@test.com"}, id="falta_password"),
        pytest.param({"password": PASSWORD_VALIDA}, id="falta_email"),
    ],
)
def test_login_con_campos_faltantes_devuelve_422(cliente, body):
    assert cliente.post("/auth/login", json=body).status_code == 422


def test_login_con_email_inexistente_devuelve_401(cliente):
    respuesta = loguear(cliente, "nadie@test.com")
    assert respuesta.status_code == 401


def test_login_con_password_incorrecto_y_cuenta_verificada_devuelve_401(cliente, usuario_verificado):
    respuesta = loguear(cliente, usuario_verificado["email"], "Incorrecta123!")
    assert respuesta.status_code == 401


def test_login_con_password_incorrecto_y_cuenta_sin_verificar_devuelve_401(
    cliente, usuario_sin_verificar
):
    respuesta = loguear(cliente, usuario_sin_verificar["email"], "Incorrecta123!")
    assert respuesta.status_code == 401


def test_los_tres_errores_de_credenciales_devuelven_el_mismo_mensaje_exacto(
    cliente, usuario_verificado, usuario_sin_verificar
):
    inexistente = loguear(cliente, "nadie@test.com")
    verificado = loguear(cliente, usuario_verificado["email"], "Incorrecta123!")
    sin_verificar = loguear(cliente, usuario_sin_verificar["email"], "Incorrecta123!")

    assert inexistente.status_code == verificado.status_code == sin_verificar.status_code == 401
    assert inexistente.content == verificado.content == sin_verificar.content


def test_login_correcto_con_cuenta_sin_verificar_devuelve_403(cliente, usuario_sin_verificar):
    respuesta = loguear(cliente, usuario_sin_verificar["email"])
    assert respuesta.status_code == 403


def test_el_403_de_cuenta_sin_verificar_no_reusa_el_mensaje_generico(
    cliente, usuario_verificado, usuario_sin_verificar
):
    generico = loguear(cliente, usuario_verificado["email"], "Incorrecta123!")
    especifico = loguear(cliente, usuario_sin_verificar["email"])

    assert especifico.json()["detail"] != generico.json()["detail"]


def test_login_correcto_devuelve_access_token_con_claims_sub_y_rol(cliente, usuario_verificado):
    respuesta = loguear(cliente, usuario_verificado["email"])

    assert respuesta.status_code == 200
    payload = jwt.decode(
        respuesta.json()["access_token"], os.environ["JWT_SECRET_KEY"], algorithms=["HS256"]
    )
    assert payload["sub"] == str(usuario_verificado["id"])
    assert payload["rol"] == usuario_verificado["rol"]


def test_login_correcto_persiste_el_refresh_token_hasheado_en_la_db(cliente, usuario_verificado):
    from core.security import hashear_sha256

    respuesta = loguear(cliente, usuario_verificado["email"])

    guardados = refresh_tokens_de(usuario_verificado["id"])
    assert len(guardados) == 1
    assert guardados[0]["token_hash"] == hashear_sha256(cookie_refresh(respuesta))
    assert guardados[0]["revocado"] is False


def test_login_correcto_manda_el_refresh_en_cookie_httponly_secure_samesite_strict(
    cliente, usuario_verificado
):
    respuesta = loguear(cliente, usuario_verificado["email"])

    cookie = cookies_de(respuesta)["refresh_token"]
    assert cookie["httponly"]
    assert cookie["secure"]
    assert cookie["samesite"].lower() == "strict"


def test_el_access_token_no_viaja_en_cookie(cliente, usuario_verificado):
    respuesta = loguear(cliente, usuario_verificado["email"])
    assert "access_token" in respuesta.json()
    assert "access_token" not in cookies_de(respuesta)


def test_superar_el_limite_por_minuto_devuelve_429(cliente, limitador_activo):
    codigos = [loguear(cliente, "nadie@test.com").status_code for _ in range(6)]
    assert codigos[-1] == 429


def test_el_rate_limit_por_ip_se_dispara_aunque_los_emails_sean_distintos(
    cliente, limitador_activo
):
    for i in range(5):
        crear_usuario(f"rate{i}@test.com", verificado=True)

    codigos = [loguear(cliente, f"rate{i}@test.com", "Incorrecta123!").status_code for i in range(5)]
    ultimo = loguear(cliente, "rate0@test.com").status_code

    assert codigos == [401] * 5
    assert ultimo == 429
