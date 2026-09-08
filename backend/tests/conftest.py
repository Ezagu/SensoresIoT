import os
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

import psycopg2
import pytest
from unittest import mock

RAIZ_BACKEND = Path(__file__).resolve().parents[1]
RAIZ_REPO = RAIZ_BACKEND.parent
sys.path.insert(0, str(RAIZ_BACKEND))

def _url_por_defecto():
    # Sin TEST_DATABASE_URL se asume el db_test de docker-compose.test.yml, que
    # comparte la password del .env de la raíz.
    from dotenv import dotenv_values

    password = dotenv_values(RAIZ_REPO / ".env").get("POSTGRES_PASSWORD", "postgres")
    return f"postgresql://postgres:{quote(password)}@localhost:5434/postgres"


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or _url_por_defecto()
_url = urlparse(TEST_DATABASE_URL)
CONEXION = {
    "host": _url.hostname or "localhost",
    "port": str(_url.port or 5434),
    "dbname": (_url.path or "/postgres").lstrip("/") or "postgres",
    "user": unquote(_url.username or "postgres"),
    "password": unquote(_url.password or ""),
}
# db.py y core/config.py leen os.getenv en import time, y load_dotenv() no pisa
# variables ya seteadas: todo el entorno se fija antes de importar la app.
os.environ["DB_HOST"] = CONEXION["host"]
os.environ["DB_PORT"] = CONEXION["port"]
os.environ["DB_NAME"] = CONEXION["dbname"]
os.environ["DB_USER"] = CONEXION["user"]
os.environ["POSTGRES_PASSWORD"] = CONEXION["password"]

os.environ["ENTORNO"] = "production"
os.environ["JWT_SECRET_KEY"] = "clave-de-test-no-usar-en-produccion"
os.environ["RESEND_API_KEY"] = "re_test_dummy"
os.environ["FRONTEND_URL"] = "http://localhost:5173"

from fastapi.testclient import TestClient  # noqa: E402

from core.limiter import limiter  # noqa: E402
from main import app  # noqa: E402
from tests.utilidades import conexion, crear_usuario  # noqa: E402

TABLAS_A_LIMPIAR = "usuarios, refresh_token, verificaciones_email"


def _statements(sql: str):
    # init.sql no tiene bloques $$; alcanza con partir en ';' ignorando los que
    # caen dentro de una cadena.
    actual, en_cadena = [], False
    for char in sql:
        if char == "'":
            en_cadena = not en_cadena
        if char == ";" and not en_cadena:
            yield "".join(actual)
            actual = []
        else:
            actual.append(char)
    if "".join(actual).strip():
        yield "".join(actual)


def _alinear_con_esquema_real():
    # db/init.sql declara usuarios.intentos_fallido (singular), pero el backend
    # y la base de dev/prod usan intentos_fallidos. Sin este rename, una base
    # creada desde init.sql revienta con 500 en todo login.
    # Ver tests/test_esquema.py: el drift se reporta como test rojo, no se tapa.
    with conexion() as cur:
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'usuarios' AND column_name = 'intentos_fallido'
            """
        )
        if cur.fetchone():
            cur.execute(
                "ALTER TABLE usuarios RENAME COLUMN intentos_fallido TO intentos_fallidos"
            )


@pytest.fixture(scope="session", autouse=True)
def esquema():
    with conexion() as cur:
        cur.execute("SELECT to_regclass('public.usuarios') AS tabla")
        ya_esta = cur.fetchone()["tabla"] is not None
    if ya_esta:
        _alinear_con_esquema_real()
        return

    init_sql = (RAIZ_REPO / "db" / "init.sql").read_text(encoding="utf-8")
    conn = psycopg2.connect(**CONEXION)
    conn.autocommit = True  # las continuous aggregates no corren en transacción
    try:
        with conn.cursor() as cur:
            for statement in _statements(init_sql):
                if statement.strip():
                    cur.execute(statement)
    finally:
        conn.close()

    _alinear_con_esquema_real()


@pytest.fixture(autouse=True)
def limpiar_db(esquema):
    # TRUNCATE y no rollback: los tests verifican qué quedó realmente commiteado.
    with conexion() as cur:
        cur.execute(f"TRUNCATE {TABLAS_A_LIMPIAR} RESTART IDENTITY CASCADE")
    yield


@pytest.fixture(autouse=True)
def sin_rate_limit():
    # TestClient siempre llega con la misma IP: sin esto el 3/hour de /register
    # y el 5/minute de /login agotan la cuota para toda la suite.
    limiter.reset()
    limiter.enabled = False
    yield
    limiter.enabled = False


@pytest.fixture
def limitador_activo():
    limiter.reset()
    limiter.enabled = True
    yield
    limiter.enabled = False
    limiter.reset()


@pytest.fixture
def cliente():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def mail():
    with mock.patch("services.auth_service.enviar_email_verificacion") as enviar:
        yield enviar


@pytest.fixture
def usuario_verificado():
    return crear_usuario("verificado@test.com", "Password123!", verificado=True)


@pytest.fixture
def usuario_sin_verificar():
    return crear_usuario("sinverificar@test.com", "Password123!", verificado=False)


@pytest.fixture
def usuario_admin():
    return crear_usuario("admin@test.com", "Password123!", verificado=True, rol="admin")
