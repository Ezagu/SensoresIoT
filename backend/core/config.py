import os
from dotenv import load_dotenv

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

def get_cors_origins() -> list[str]:
  origins = os.getenv("CORS_ORIGINS", "")
  return [origin.strip() for origin in origins.split(",") if origin.strip()]