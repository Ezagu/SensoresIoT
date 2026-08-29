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
            hash_anterior = dispositivo["secret_hash_anterior"]

            # Durante una rotación sin confirmar valen los dos secrets: el nuevo y el
            # anterior. Que el dispositivo llegue con el nuevo es la señal de que lo
            # persistió en NVS, así que ahí recién se descarta el viejo.
            if verificar_secrets(secret_hash, dispositivo["secret_hash"]):
                if hash_anterior is not None:
                    dispositivo_repo.confirmar_rotacion(cur, dispositivo["id"])
                    dispositivo["secret_hash_anterior"] = None
            elif hash_anterior is not None and verificar_secrets(secret_hash, hash_anterior):
                pass  # rotación todavía sin confirmar, el firmware la va a reintentar
            else:
                raise HTTPException(401, "credenciales inválidas")

            if not dispositivo["activo"]:
                raise HTTPException(401, "credenciales inválidas")
    return dispositivo