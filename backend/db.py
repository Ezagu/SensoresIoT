import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(
        dbname="sensores_iot", 
        user="postgres", 
        password=os.environ["POSTGRES_PASSWORD"], 
        port=5433
    )