COLUMNAS = """
    id, nombre, dispositivos_incluidos, retencion_dias, intervalo_minimo_seg,
    puede_alertas, max_alertas, puede_compartir, puede_exportar
"""

def listar_activos(cur) -> list[dict]:
    # Catálogo público de planes
    cur.execute(f"SELECT {COLUMNAS} FROM planes WHERE activo = true ORDER BY id")
    return cur.fetchall()

def buscar_por_id(cur, plan_id) -> dict | None:
    # Sin filtrar por activo: plan_service lo usa para resolver el fallback a 'free',
    # que tiene que seguir funcionando aunque el plan se saque del catálogo público.
    cur.execute(f"SELECT {COLUMNAS} FROM planes WHERE id = %s", (plan_id,))
    return cur.fetchone()
