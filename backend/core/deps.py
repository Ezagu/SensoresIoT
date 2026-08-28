import psycopg2.extras
from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from uuid import UUID
from db import get_connection
from repositories import dispositivo_repo
from core.security import verificar_access_token, hashear_sha256, verificar_secrets

bearer_scheme = HTTPBearer()

def get_usuario_actual(credenciales: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    payload = verificar_access_token(credenciales.credentials)
    return payload

def get_usuario_admin(usuario_actual: dict = Depends(get_usuario_actual)):
    if usuario_actual["rol"] != "admin":
        raise HTTPException(403, "No tenés permisos para acceder a este recurso")
    return usuario_actual

def get_dispositivo_autenticado(
    x_dispositivo_id: UUID = Header(...),
    credenciales: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> dict:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            dispositivo = dispositivo_repo.buscar_por_id(cur, x_dispositivo_id)
            if not dispositivo:
                raise HTTPException(401, "credenciales inválidas")

            secret_hash = hashear_sha256(credenciales.credentials)
            if not verificar_secrets(secret_hash, dispositivo["secret_hash"]):
                raise HTTPException(401, "credenciales inválidas")

            if not dispositivo["activo"]:
                raise HTTPException(401, "credenciales inválidas")
    return dispositivo