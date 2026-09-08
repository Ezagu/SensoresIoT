import pytest

from tests.utilidades import contar_usuarios, crear_usuario, fila_usuario

ALTA_VALIDA = {"nombre": "Nueva Persona", "email": "nueva@test.com", "password": "Password123!"}

FILTRACIONES = ("existe", "registrad", "en uso", "duplicad", "ya está")


def registrar(cliente, **cambios):
    return cliente.post("/auth/register", json={**ALTA_VALIDA, **cambios})


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({}, id="body_vacio"),
        pytest.param({"nombre": "Alguien", "password": "Password123!"}, id="falta_email"),
        pytest.param({"nombre": "Alguien", "email": "alguien@test.com"}, id="falta_password"),
        pytest.param({"email": "alguien@test.com", "password": "Password123!"}, id="falta_nombre"),
    ],
)
def test_registro_con_campos_faltantes_devuelve_422(cliente, body):
    assert cliente.post("/auth/register", json=body).status_code == 422


@pytest.mark.parametrize(
    "email",
    [
        pytest.param("sin-arroba", id="sin_arroba"),
        pytest.param("sin@dominio", id="sin_dominio"),
        pytest.param("@sinlocal.com", id="sin_parte_local"),
        pytest.param("con espacio@test.com", id="con_espacio"),
        pytest.param("doble@@test.com", id="doble_arroba"),
    ],
)
def test_registro_con_email_de_formato_invalido_devuelve_422(cliente, email):
    assert registrar(cliente, email=email).status_code == 422


@pytest.mark.parametrize(
    "password",
    [
        pytest.param("", id="vacia"),
        pytest.param("Pass1!a", id="siete_caracteres"),
        pytest.param("A1!" + "a" * 126, id="mas_de_128"),
        pytest.param("password123!", id="sin_mayuscula"),
        pytest.param("PASSWORD123!", id="sin_minuscula"),
        pytest.param("Passwordddd!", id="sin_digito"),
        pytest.param("Password1234", id="sin_simbolo"),
    ],
)
def test_registro_con_password_que_no_cumple_la_politica_devuelve_422(cliente, password):
    assert registrar(cliente, password=password).status_code == 422


def test_registro_exitoso_devuelve_201_y_crea_usuario_sin_verificar(cliente, mail):
    respuesta = registrar(cliente)

    assert respuesta.status_code == 201
    usuario = fila_usuario(ALTA_VALIDA["email"])
    assert usuario is not None
    assert usuario["is_verified"] is False
    assert mail.call_count == 1


def test_registro_con_email_de_cuenta_verificada_responde_como_alta_exitosa(cliente, mail):
    crear_usuario(ALTA_VALIDA["email"], "OtraPassword123!", verificado=True)
    mail.reset_mock()
    exitosa = registrar(cliente, email="referencia@test.com")
    mail.reset_mock()

    respuesta = registrar(cliente)

    assert respuesta.status_code == exitosa.status_code
    assert respuesta.json().keys() == exitosa.json().keys()
    assert not any(pista in respuesta.text.lower() for pista in FILTRACIONES)


def test_registro_con_email_de_cuenta_verificada_no_duplica_ni_manda_mail(cliente, mail):
    crear_usuario(ALTA_VALIDA["email"], "OtraPassword123!", verificado=True)
    mail.reset_mock()

    registrar(cliente)

    assert contar_usuarios(ALTA_VALIDA["email"]) == 1
    assert mail.call_count == 0


def test_registro_con_email_de_cuenta_sin_verificar_responde_como_alta_exitosa(cliente, mail):
    crear_usuario(ALTA_VALIDA["email"], "OtraPassword123!", verificado=False)
    exitosa = registrar(cliente, email="referencia@test.com")

    respuesta = registrar(cliente)

    assert respuesta.status_code == exitosa.status_code
    assert respuesta.json().keys() == exitosa.json().keys()
    assert not any(pista in respuesta.text.lower() for pista in FILTRACIONES)


def test_registro_con_email_de_cuenta_sin_verificar_reenvia_el_mail_sin_duplicar(cliente, mail):
    crear_usuario(ALTA_VALIDA["email"], "OtraPassword123!", verificado=False)
    mail.reset_mock()

    registrar(cliente)

    assert contar_usuarios(ALTA_VALIDA["email"]) == 1
    assert mail.call_count == 1
