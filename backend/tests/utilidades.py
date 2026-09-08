import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie

import jwt
import psycopg2
import psycopg2.extras

PASSWORD_VALIDA = "Password123!"


def _params():
    return {
        "host": os.environ["DB_HOST"],
        "port": os.environ["DB_PORT"],
        "dbname": os.environ["DB_NAME"],
        "user": os.environ["DB_USER"],
        "password": os.environ["POSTGRES_PASSWORD"],
    }


@contextmanager
def conexion():
    # Conexión propia, ajena a db.get_connection(): es la única forma de ver qué
    # quedó commiteado después de que la request terminó.
    conn = psycopg2.connect(**_params())
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        conn.commit()
    finally:
        conn.close()


def crear_usuario(
    email,
    password=PASSWORD_VALIDA,
    *,
    nombre="Usuario Test",
    verificado=True,
    rol="user",
    intentos=0,
    bloqueado_hasta=None,
):
    from core.security import hash_password

    with conexion() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (nombre, email, password, rol, is_verified,
                                  intentos_fallidos, bloqueado_hasta)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (nombre, email, hash_password(password), rol, verificado, intentos, bloqueado_hasta),
        )
        usuario_id = cur.fetchone()["id"]
    return {"id": usuario_id, "email": email, "password": password, "rol": rol}


def crear_token_verificacion(usuario_id, *, vence_en=timedelta(hours=24)):
    from core.security import generar_secret_urlsafe

    token, token_hash = generar_secret_urlsafe()
    with conexion() as cur:
        cur.execute(
            """
            INSERT INTO verificaciones_email (usuario_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (usuario_id, token_hash, datetime.now(timezone.utc) + vence_en),
        )
    return token


def fila_usuario(email):
    with conexion() as cur:
        cur.execute("SELECT * FROM usuarios WHERE email = %s", (email,))
        return cur.fetchone()


def contar_usuarios(email=None):
    with conexion() as cur:
        if email is None:
            cur.execute("SELECT count(*) AS n FROM usuarios")
        else:
            cur.execute("SELECT count(*) AS n FROM usuarios WHERE email = %s", (email,))
        return cur.fetchone()["n"]


def refresh_tokens_de(usuario_id):
    with conexion() as cur:
        cur.execute(
            "SELECT * FROM refresh_token WHERE usuario_id = %s ORDER BY created_at",
            (usuario_id,),
        )
        return cur.fetchall()


def jwt_de_prueba(sub, rol="user", *, expira_en=timedelta(minutes=30), secreto=None):
    ahora = datetime.now(timezone.utc)
    payload = {"sub": str(sub), "rol": rol, "iat": ahora, "exp": ahora + expira_en}
    return jwt.encode(payload, secreto or os.environ["JWT_SECRET_KEY"], "HS256")


def cookies_de(respuesta):
    cookies = {}
    for cabecera in respuesta.headers.get_list("set-cookie"):
        parseada = SimpleCookie()
        parseada.load(cabecera)
        cookies.update(parseada)
    return cookies


def cookie_refresh(respuesta):
    cookie = cookies_de(respuesta).get("refresh_token")
    return cookie.value if cookie else None


def loguear(cliente, email, password=PASSWORD_VALIDA):
    cliente.cookies.clear()
    return cliente.post("/auth/login", json={"email": email, "password": password})


def con_cookie(cliente, ruta, refresh_token=None):
    # El jar del TestClient se limpia a mano para poder mandar exactamente el
    # refresh token que el test quiere probar (o ninguno).
    cliente.cookies.clear()
    cabeceras = {"Cookie": f"refresh_token={refresh_token}"} if refresh_token else {}
    return cliente.post(ruta, headers=cabeceras)


def autorizacion(token):
    return {"Authorization": f"Bearer {token}"}
