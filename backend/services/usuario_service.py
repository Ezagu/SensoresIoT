from fastapi import HTTPException
from repositories import usuario_repo, dispositivo_repo
from services import dispositivo_service, plan_service
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
    # El intervalo efectivo y el online salen de acá y no del front: son el mismo
    # criterio que usan el panel y el detalle, resuelto en un solo lugar.
    with get_cursor() as cur:
        dispositivos = dispositivo_repo.buscar_por_usuario(cur, usuario_id)
        planes = plan_service.limites_de_dispositivos(cur, [d["id"] for d in dispositivos])

        for d in dispositivos:
            plan = planes.get(d["id"], plan_service.LIMITES_FREE)
            intervalo = plan_service.intervalo_efectivo_seg(
                d["intervalo_configurado_seg"], plan["intervalo_minimo_seg"]
            )
            d["intervalo_efectivo_seg"] = intervalo
            d["online"] = dispositivo_service.esta_online(d["last_seen_at"], intervalo)

        return dispositivos
