import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from contextlib import contextmanager

psycopg2.extras.register_uuid()

load_dotenv()

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
    finally:
        conn.close()