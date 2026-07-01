import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

psycopg2.extras.register_uuid()  # le enseña a psycopg2 a adaptar uuid.UUID -> Postgres UUID

load_dotenv()

def get_connection():
    return psycopg2.connect(
        dbname="sensores_iot", 
        user="postgres", 
        password=os.environ["POSTGRES_PASSWORD"], 
        port=5433
    )