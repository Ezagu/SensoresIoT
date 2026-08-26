import bcrypt
import secrets
import hashlib

def hash_password(password: str):
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

def generar_token_verificacion():
    token = secrets.token_urlsafe(32)
    token_hash = hashear_token(token)
    return token, token_hash

def hashear_token(token: str):
    return hashlib.sha256(token.encode()).hexdigest()

def generar_secret_dispositivo():
    secret = secrets.token_hex(32)
    secret_hash = hashear_token(secret)
    return secret, secret_hash

