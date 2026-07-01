import psycopg2
import os
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

def get_connection():
    return psycopg2.connect(
        dbname="sensores_iot", 
        user="postgres", 
        password=os.environ["POSTGRES_PASSWORD"], 
        port=5433
    )

class MedicionIn(BaseModel):
    sensor_id: str
    value: float
    time: Optional[datetime] = None

@app.post("/ingest")
def ingest(medicion: MedicionIn):
    timestamp = medicion.time or datetime.now(timezone.utc)

    with get_connection() as conn:
        with conn.cursor() as curs:
            curs.execute(
                "SELECT 1 FROM sensores WHERE id = %s",
                (medicion.sensor_id,)
            )
            if curs.fetchone() is None:
                raise HTTPException(status_code=404, detail="Sensor no encontrado")

            curs.execute(
                "INSERT INTO mediciones (time, sensor_id, value) VALUES (%s, %s, %s)",
                (timestamp, medicion.sensor_id, medicion.value)
            )

    return {"status": "ok"}