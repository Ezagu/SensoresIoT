from datetime import timedelta

import pytest

from tests.utilidades import autorizacion, jwt_de_prueba

ENDPOINT_USUARIO = "/auth/me"
ENDPOINT_ADMIN = "/usuarios/"


@pytest.mark.parametrize("ruta", [ENDPOINT_USUARIO, ENDPOINT_ADMIN])
def test_sin_header_de_autorizacion_devuelve_401(cliente, ruta):
    assert cliente.get(ruta).status_code == 401


@pytest.mark.parametrize(
    "header",
    [
        pytest.param("", id="vacio"),
        pytest.param("basura", id="sin_esquema"),
        pytest.param("Basic dXNlcjpwYXNz", id="esquema_equivocado"),
        pytest.param("Bearer", id="bearer_sin_token"),
        pytest.param("Bearer no.es.un.jwt", id="token_no_jwt"),
    ],
)
def test_header_malformado_devuelve_401(cliente, header):
    assert cliente.get(ENDPOINT_USUARIO, headers={"Authorization": header}).status_code == 401


def test_token_expirado_devuelve_401(cliente, usuario_verificado):
    token = jwt_de_prueba(usuario_verificado["id"], expira_en=timedelta(minutes=-1))

    assert cliente.get(ENDPOINT_USUARIO, headers=autorizacion(token)).status_code == 401


def test_token_con_firma_invalida_devuelve_401(cliente, usuario_verificado):
    token = jwt_de_prueba(usuario_verificado["id"], secreto="otra-clave-cualquiera")

    assert cliente.get(ENDPOINT_USUARIO, headers=autorizacion(token)).status_code == 401


def test_token_de_usuario_en_endpoint_de_usuario_devuelve_200(cliente, usuario_verificado):
    token = jwt_de_prueba(usuario_verificado["id"], "user")

    assert cliente.get(ENDPOINT_USUARIO, headers=autorizacion(token)).status_code == 200


def test_token_de_usuario_en_endpoint_de_admin_devuelve_403(cliente, usuario_verificado):
    token = jwt_de_prueba(usuario_verificado["id"], "user")

    assert cliente.get(ENDPOINT_ADMIN, headers=autorizacion(token)).status_code == 403


def test_token_de_admin_en_endpoint_de_admin_devuelve_200(cliente, usuario_admin):
    token = jwt_de_prueba(usuario_admin["id"], "admin")

    assert cliente.get(ENDPOINT_ADMIN, headers=autorizacion(token)).status_code == 200
