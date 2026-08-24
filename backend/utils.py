import os
import secrets
import hashlib
import resend
from datetime import datetime, timedelta

resend.api_key = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

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

def generate_verification_token() -> tuple[str, str]:
  token = secrets.token_urlsafe(32)
  token_hash = hashlib.sha256(token.encode()).hexdigest()
  return token, token_hash

def send_verification_email(to: str, token:str):
  verify_link = f"{FRONTEND_URL}/verify?token={token}"

  resend.Emails.send({
        "from": "onboarding@resend.dev",
        "to": [to],
        "subject": "Confirmá tu cuenta",
        "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Confirmá tu cuenta</h2>
                <p>Hacé click en el siguiente botón para verificar tu email:</p>
                <a href="{verify_link}"
                  style="display:inline-block; padding:12px 24px; background:#111;
                          color:#fff; text-decoration:none; border-radius:6px;">
                    Verificar email
                </a>
                <p style="color:#666; font-size:13px; margin-top:24px;">
                    Este link expira en 24 horas. Si no creaste esta cuenta, ignorá este mail.
                </p>
            </div>
        """
    })