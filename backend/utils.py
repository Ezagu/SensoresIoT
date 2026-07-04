import os
from datetime import datetime, timedelta

def calcular_intervalo(desde: datetime, hasta: datetime):
  duracion = hasta - desde
  if duracion <= timedelta(hours=4):
    return "1 minute"
  elif duracion <= timedelta(hours=12):
    return "3 minutes"
  elif duracion <= timedelta(hours=24):
    return "5 minutes"
  elif duracion <= timedelta(hours=48):
    return "10 minutes"
  elif duracion <= timedelta(days=5):
    return "30 minutes"
  elif duracion <= timedelta(days=12):
    return "1 hour"
  elif duracion <= timedelta(weeks=4):
    return "3 hours"
  elif duracion <= timedelta(weeks=10):
    return "6 hours"
  elif duracion <= timedelta(weeks=22):
    return "12 hours"
  elif duracion <= timedelta(weeks=40):
    return "1 day"
  elif duracion <= timedelta(weeks=72):
    return "2 days"
  else:
    return "1 week"
  
def get_cors_origins() -> list[str]:
  origins = os.getenv("CORS_ORIGINS", "")
  return [origin.strip() for origin in origins.split(",") if origin.strip()]