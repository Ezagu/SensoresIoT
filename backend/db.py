import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

psycopg2.extras.register_uuid()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD")

@contextmanager
def get_connection():
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT,
        host=DB_HOST
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

@contextmanager
def get_cursor():
    # Conexión + cursor dict: el caso normal de cualquier servicio.
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur

@contextmanager
def get_cursor_streaming(nombre: str, itersize: int = 2000):
    # Cursor server-side (DECLARE ... CURSOR): Postgres manda las filas de a
    # `itersize` en vez del resultado entero. Pensado para generadores que se
    # consumen fuera de la request (StreamingResponse) y necesitan la conexión
    # viva mientras se itera, no para el uso normal de un service.
    # `nombre` tiene que ser único por request (no reusar cursores server-side).
    with get_connection() as conn:
        with conn.cursor(name=nombre, cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.itersize = itersize
            yield cur