from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.security import verificar_access_token

bearer_scheme = HTTPBearer()

def get_usuario_actual(credenciales: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    token = credenciales.credentials
    payload = verificar_access_token(token)
    return payload


def get_usuario_admin(usuario_actual: dict = Depends(get_usuario_actual)) -> dict:
    if usuario_actual["rol"] != "admin":
        raise HTTPException(403, "No tenés permisos para acceder a este recurso")
    return usuario_actual