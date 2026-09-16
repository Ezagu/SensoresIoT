from datetime import datetime, timedelta, timezone
from repositories import dispositivo_repo, sensor_repo, medicion_repo, alerta_repo
from services import dispositivo_service, plan_service
from db import get_cursor

# Techo duro de la hypertable cruda (FUENTES[0]["retencion"] en medicion_repo):
# ni premium ni admin tienen datos crudos más viejos que esto, así que acotar acá
# le da a Timescale exclusión de chunks en vez de recorrer buscando un sensor muerto.
RETENCION_MAXIMA_CRUDA = timedelta(days=90)

def listar_panel(usuario_id) -> dict:
    with get_cursor() as cur:
        dispositivos = dispositivo_repo.buscar_por_usuario(cur, usuario_id)
        ids = [d["id"] for d in dispositivos]

        sensores = sensor_repo.buscar_con_tipo_por_dispositivos(cur, ids)
        planes = plan_service.limites_de_dispositivos(cur, ids)
        disparadas = alerta_repo.disparadas_por_dispositivos(cur, ids)

        sensores_por_dispositivo: dict = {}
        for s in sensores:
            sensores_por_dispositivo.setdefault(s["dispositivo_id"], []).append(s)

        disparadas_por_sensor = {a["sensor_id"] for a in disparadas}
        disparadas_por_dispositivo: dict = {}
        for a in disparadas:
            disparadas_por_dispositivo[a["dispositivo_id"]] = disparadas_por_dispositivo.get(a["dispositivo_id"], 0) + 1

        ahora = datetime.now(timezone.utc)
        piso_maximo = ahora - RETENCION_MAXIMA_CRUDA

        pares = []
        for d in dispositivos:
            plan = planes.get(d["id"], plan_service.LIMITES_FREE)
            dias = plan["retencion_dias"]
            # admin no pasa por acá (no es un rol de dispositivo): la exención de
            # retención del admin no aplica al panel, que sólo lista SUS vínculos.
            piso = piso_maximo if dias is None else max(ahora - timedelta(days=dias), piso_maximo)
            for s in sensores_por_dispositivo.get(d["id"], []):
                pares.append((s["id"], piso))

        ultimas = medicion_repo.ultimas_por_sensores(cur, pares)

        salida = []
        for d in dispositivos:
            plan = planes.get(d["id"], plan_service.LIMITES_FREE)
            intervalo_efectivo = plan_service.intervalo_efectivo_seg(
                d["intervalo_configurado_seg"], plan["intervalo_minimo_seg"]
            )

            sensores_out = []
            for s in sensores_por_dispositivo.get(d["id"], []):
                ultima = ultimas.get(s["id"])
                sensores_out.append({
                    "id": s["id"],
                    "tipo_sensor_id": s["tipo_sensor_id"],
                    "tipo_nombre": s["tipo_nombre"],
                    "unidad": s["unidad"],
                    "ultimo_valor": ultima["value"] if ultima else None,
                    "ultimo_at": ultima["time"] if ultima else None,
                    "disparada": s["id"] in disparadas_por_sensor,
                })

            salida.append({
                **d,
                "intervalo_efectivo_seg": intervalo_efectivo,
                "online": dispositivo_service.esta_online(d["last_seen_at"]),
                "alertas_disparadas": disparadas_por_dispositivo.get(d["id"], 0),
                "sensores": sensores_out,
            })

        return {"dispositivos": salida}
