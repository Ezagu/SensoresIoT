from fastapi import HTTPException
from repositories import usuario_repo, dispositivo_repo
from db import get_cursor

def listar_usuarios() -> list[dict]:
    with get_cursor() as cur:
        return usuario_repo.listar(cur)

def obtener_usuario(usuario_id) -> dict:
    with get_cursor() as cur:
        usuario = usuario_repo.buscar_por_id(cur, usuario_id)
        if usuario is None:
            raise HTTPException(404, "Usuario no encontrado")
        return usuario

def obtener_dispositivos_de_usuario(usuario_id) -> list[dict]:
    with get_cursor() as cur:
        return dispositivo_repo.buscar_por_usuario(cur, usuario_id)
