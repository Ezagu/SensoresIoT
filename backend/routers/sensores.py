import psycopg2.extras
from fastapi import APIRouter, HTTPException
from uuid import UUID
from datetime import datetime, timezone, timedelta
from typing import Optional
from utils import calcular_intervalo
from models.sensor import SensorCreate, SensorOut, TipoSensorOut
from models.medicion import DatosGraficoOut

from db import get_connection

router = APIRouter()

@router.post("/", response_model=SensorOut)
def create_sensor(sensor: SensorCreate):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      try:
        cur.execute(
          """
          INSERT INTO sensores (dispositivo_id, tipo_sensor_id, nombre)
          VALUES (%s, %s, %s)
          RETURNING *
          """,
          (sensor.dispositivo_id, sensor.tipo_sensor_id, sensor.nombre)
        )
        return cur.fetchone()
      except psycopg2.errors.ForeignKeyViolation:
        raise HTTPException(404, "dispositivo_id o tipo_sensor_id no existen")
      
@router.get("/{sensor_id}", response_model=SensorOut)
def get_sensor_by_id(sensor_id: UUID):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      cur.execute("SELECT * FROM sensores WHERE id = %s", (sensor_id,))
      sensor = cur.fetchone()
      if sensor is None:
        raise HTTPException(404, "sensor no existe")
      return sensor

@router.get("/{sensor_id}/mediciones/grafico", response_model=DatosGraficoOut)
def get_mediciones(
  sensor_id: UUID, 
  desde: Optional[datetime] = None, 
  hasta: Optional[datetime] = None,
):
  hasta = hasta or datetime.now(timezone.utc)
  desde = desde or hasta - timedelta(hours=24)
  intervalo = calcular_intervalo(desde, hasta)

  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      cur.execute("SELECT 1 FROM sensores WHERE id = %s", (sensor_id,))
      if cur.fetchone() is None:
        raise HTTPException(404, "Sensor no encontrado")
      
      cur.execute(
        """
        SELECT
          time_bucket(%s, time) AS bucket,
          AVG(value) AS promedio,
          MIN(value) AS minimo,
          MAX(value) AS maximo
        FROM mediciones
        WHERE sensor_id = %s AND time >= %s AND time <= %s
        GROUP BY bucket
        ORDER BY bucket ASC
        """,
        (intervalo, sensor_id, desde, hasta)
      )
      puntos = cur.fetchall()

      cur.execute(
        """
        SELECT 
          AVG(value) AS promedio, 
          MIN(value) AS minimo, 
          MAX(value) AS maximo 
        FROM mediciones
        WHERE sensor_id = %s AND time >= %s AND time <= %s
        """,
        (sensor_id, desde, hasta)
      )
      resumen = cur.fetchone()

  return {"puntos": puntos, "resumen": resumen}

@router.get("/{sensor_id}/tipo-sensor", response_model=TipoSensorOut)
def get_tipo_sensor(sensor_id):
  with get_connection() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
      cur.execute(
        """
        SELECT ts.nombre, ts.unidad 
        FROM sensores s
        JOIN tipos_sensor ts ON s.tipo_sensor_id = ts.id
        WHERE s.id = %s 
        """,
        (sensor_id,)
      )
      return cur.fetchone()