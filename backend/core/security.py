import bcrypt
import secrets
import hashlib
import jwt
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
from core.config import JWT_SECRET_KEY

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def hash_password(password: str):
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

def verify_password(password: str, hash_password: str):
    return bcrypt.checkpw(password.encode("utf-8"), hash_password.encode("utf-8"))

def generar_secret():
    secret = secrets.token_hex(32)
    secret_hash = hashear_sha256(secret)
    return secret, secret_hash

def generar_secret_urlsafe():
    token = secrets.token_urlsafe(32)
    token_hash = hashear_sha256(token)
    return token, token_hash

def hashear_sha256(token: str):
    return hashlib.sha256(token.encode()).hexdigest()

def crear_access_token(usuario_id: str, rol: str) -> str:
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario_id),
        "rol": rol,
        "iat": ahora,            
        "exp": ahora + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, ALGORITHM)

def verificar_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")

    return payload