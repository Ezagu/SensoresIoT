import csv
import re
import unicodedata
from uuid import uuid4
from datetime import datetime, timezone
from fastapi import HTTPException
from repositories import sensor_repo, medicion_repo, dispositivo_repo
from services import dispositivo_service, plan_service
from core.tiempo import a_utc
from db import get_cursor, get_cursor_streaming

ETIQUETAS_FUENTE = {
    "mediciones": "crudo",
    "mediciones_por_hora": "por-hora",
    "mediciones_por_dia": "por-dia",
}

def _slug(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", texto).strip("-")

def _etiqueta_resolucion(fuente, bucket) -> str:
    # Granularidad de salida: la de la tabla si no hay bucket, si no el intervalo
    # efectivo (puede diferir del pedido si se subió a la granularidad del agregado).
    if bucket is None:
        return ETIQUETAS_FUENTE[fuente["tabla"]]

    segundos = int(bucket.total_seconds())
    if segundos % 3600 == 0:
        return f"cada-{segundos // 3600}h"
    if segundos % 60 == 0:
        return f"cada-{segundos // 60}min"
    return f"cada-{segundos}s"

def _nombre_archivo(dispositivo, desde, hasta, fuente, bucket) -> str:
    slug = _slug(dispositivo["nombre"]) or str(dispositivo["id"])[:8]
    return f"{slug}_{desde:%Y%m%d}_{hasta:%Y%m%d}_{_etiqueta_resolucion(fuente, bucket)}.csv"

def _encabezados(sensores, con_stats) -> list[str]:
    # El sensor no tiene nombre propio: se usa tipo + unidad, desambiguado con
    # índice si el dispositivo repite tipo (dos sensores de temperatura).
    conteo = {}
    for s in sensores:
        conteo[s["nombre"]] = conteo.get(s["nombre"], 0) + 1

    vistos = {}
    encabezados = ["tiempo (UTC)"]
    for s in sensores:
        nombre = s["nombre"]
        if conteo[nombre] > 1:
            vistos[nombre] = vistos.get(nombre, 0) + 1
            etiqueta = f"{nombre}_{vistos[nombre]} ({s['unidad']})"
        else:
            etiqueta = f"{nombre} ({s['unidad']})"

        if con_stats:
            encabezados += [f"{etiqueta} prom", f"{etiqueta} min", f"{etiqueta} max"]
        else:
            encabezados.append(etiqueta)
    return encabezados

def _formatear_valor(valor, excel: bool) -> str:
    if valor is None:
        return ""
    texto = f"{valor:.4f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",") if excel else texto

class _BufferDeLinea:
    # csv.writer necesita un file-like; writerow() devuelve lo que write() retorna.
    def write(self, linea: str) -> str:
        return linea

def _generar_filas(sensores, desde, hasta, fuente, bucket, excel):
    writer = csv.writer(_BufferDeLinea(), delimiter=";" if excel else ",")
    con_stats = medicion_repo.export_con_stats(fuente, bucket)

    yield chr(0xFEFF)  # BOM: sin esto Excel muestra acentos y °C rotos
    yield writer.writerow(_encabezados(sensores, con_stats))

    sensor_ids = [s["id"] for s in sensores]
    if not sensor_ids:
        return

    with get_cursor_streaming(f"export_{uuid4().hex}") as cur:
        for fila in medicion_repo.iterar_pivot(cur, sensor_ids, desde, hasta, fuente, bucket):
            linea = [fila["bucket"].isoformat()]
            for i in range(len(sensores)):
                if con_stats:
                    linea.append(_formatear_valor(fila[f"s{i}_prom"], excel))
                    linea.append(_formatear_valor(fila[f"s{i}_min"], excel))
                    linea.append(_formatear_valor(fila[f"s{i}_max"], excel))
                else:
                    linea.append(_formatear_valor(fila[f"s{i}"], excel))
            yield writer.writerow(linea)

def preparar_export_dispositivo(dispositivo_id, desde, hasta, usuario_id, rol, excel: bool, intervalo_seg) -> dict:
    # Todo lo que puede fallar (404, 403, 400) se resuelve acá, antes de devolver
    # el generador: una vez arrancado el StreamingResponse no hay forma de mandar un error HTTP.
    hasta = a_utc(hasta) or datetime.now(timezone.utc)
    desde = a_utc(desde)  # None = historial completo, se resuelve contra la base

    if desde is not None and desde >= hasta:
        raise HTTPException(400, "El rango de fechas seleccionado es incorrecto")

    if intervalo_seg is not None and intervalo_seg <= 0:
        raise HTTPException(400, "El intervalo de agregación tiene que ser mayor a cero")

    with get_cursor() as cur:
        dispositivo = dispositivo_repo.buscar_por_id_publico(cur, dispositivo_id)
        if dispositivo is None:
            raise HTTPException(404, "dispositivo no existe")
        if not dispositivo_service.tiene_acceso_a_dispositivo(cur, dispositivo_id, usuario_id, rol):
            raise HTTPException(403, "No tienes acceso a este recurso")

        sensores = sensor_repo.buscar_con_tipo_por_dispositivo(cur, dispositivo_id)

        if desde is None:
            # Default: todo el historial. Sin mediciones, desde = hasta y el CSV sale sólo con encabezado.
            inicio = medicion_repo.inicio_historial(cur, [s["id"] for s in sensores])
            desde = inicio or hasta

        ventana = plan_service.ventana_de_consulta(cur, dispositivo_id, rol)
        recortado = ventana["piso"] is not None and desde < ventana["piso"]
        if recortado:
            desde = ventana["piso"]

    # Si el clamp deja desde >= hasta, min() evita una antigüedad negativa; el
    # pivot simplemente no matchea filas y el CSV sale sólo con encabezado.
    fuente, bucket = medicion_repo.fuente_para_export(min(desde, hasta), intervalo_seg)

    return {
        "nombre_archivo": _nombre_archivo(dispositivo, desde, hasta, fuente, bucket),
        "filas": _generar_filas(sensores, desde, hasta, fuente, bucket, excel),
        "resolucion": _etiqueta_resolucion(fuente, bucket),
        "fuente": ETIQUETAS_FUENTE[fuente["tabla"]],
        "intervalo_seg": int(bucket.total_seconds()) if bucket is not None else None,
        "desde_efectivo": desde,
        "recortado": recortado,
        "retencion_dias": ventana["retencion_dias"],
    }
