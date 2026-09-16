import math
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from repositories import dispositivo_repo, sensor_repo, acceso_repo, alerta_repo
from services import plan_service
from db import get_cursor

# Cada cuánto PUBLICA el equipo. El muestreo es fijo (15 s en el firmware) y no
# se configura. Lista cerrada y no un número libre: 137 s no significa nada para
# nadie, y cada escalón acá es una decisión que el cliente puede justificar.
PRESETS_INTERVALO_SEG = (60, 300, 900, 1800)
ROLES_EDICION = ("admin", "owner", "editor")
ROLES_OWNER = ("admin", "owner")
ROLES_ASIGNABLES = ("editor", "viewer")

# Cada cuánto el equipo tiene que HABLAR, publique o no. El firmware lo recibe en
# cada respuesta de /mediciones/ (`intervalo_contacto_seg`) en vez de tenerlo
# hardcodeado: en un producto que se compila por pedido, una constante del lado de
# la placa es una decisión que se arrastra años.
INTERVALO_CONTACTO_SEG = 300

# Toleramos tres contactos perdidos antes de dar por caído al equipo: uno perdido
# es un reintento normal del firmware.
INTERVALOS_DE_GRACIA = 3

# 15 min. Es UN número para todos los equipos, no 3 x su cadencia de publicación:
# esa cadencia se elige por ancho de banda y filas en la base, y no tiene por qué
# decidir qué tan rápido te enterás de una falla. Antes iba de 3 min (equipo de
# 1 min, o sea un mail por cada reinicio de router) a 90 min (equipo de 30 min).
#
# Y es el MISMO umbral con el que sale el mail, así que la frase se puede escribir
# en la pantalla sin asteriscos: cuando el panel dice "sin reportar", el mail ya
# salió. El ruido de red lo absorbe el estado intermedio "con retraso", que mide
# otra cosa (ver lecturas_al_dia).
VENTANA_SIN_REPORTAR_SEG = INTERVALO_CONTACTO_SEG * INTERVALOS_DE_GRACIA

def esta_online(last_seen_at, ahora=None) -> bool:
    # ¿El equipo está vivo? Nada más. Si mandó datos o sólo dijo "acá estoy" es
    # otra pregunta, y la contesta last_data_at.
    #
    # `ahora` existe para que el barrido de vigilancia_service le pase el reloj de
    # Postgres que ya trae en la fila: last_seen_at lo escribe Python y el filtro
    # del barrido usa now() de la base, así que un desfasaje entre los dos relojes
    # abriría caídas falsas. Las pantallas lo llaman sin el parámetro y siguen
    # usando el reloj del proceso — el predicado sigue siendo uno solo.
    if last_seen_at is None:
        return False
    transcurrido = (ahora or datetime.now(timezone.utc)) - last_seen_at
    return transcurrido < timedelta(seconds=VENTANA_SIN_REPORTAR_SEG)

def segundos_hasta_siguiente_medicion(last_seen_at, intervalo_efectivo_seg) -> int | None:
    # Cuánto falta para el próximo reporte esperado. None = nunca reportó, no hay
    # desde dónde contar.
    if last_seen_at is None:
        return None
    siguiente = last_seen_at + timedelta(seconds=intervalo_efectivo_seg)
    return max(0, math.ceil((siguiente - datetime.now(timezone.utc)).total_seconds()))

def validar_owner_en_dispositivo(cur, dispositivo_id, usuario_id, rol) -> dict:
    # Valida que exista el dispositivo, que el usuario esté vinculado y tenga permiso de edición
    dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
    rol_disp = rol_en_dispositivo(cur, dispositivo["id"], usuario_id, rol)
    if rol_disp not in ROLES_OWNER:
        raise HTTPException(403, "Tu rol en este dispositivo no te permite realizar esta acción")
    return dispositivo

def validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol) -> dict:
    # Valida que exista el dispositivo, que el usuario esté vinculado y tenga permiso de edición
    dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
    rol_disp = rol_en_dispositivo(cur, dispositivo["id"], usuario_id, rol)
    if rol_disp not in ROLES_EDICION:
        raise HTTPException(403, "Tu rol en este dispositivo no te permite realizar esta acción")
    return dispositivo

def validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol) -> dict:
    # Valida que exista el dispositivo y que el usuario esté vinculado
    dispositivo = validar_que_exista_dispositivo(cur, dispositivo_id)
    rol_disp = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
    if not rol_disp:
        raise HTTPException(403, "No tienes acceso a este recurso")
    return dispositivo

def validar_que_exista_dispositivo(cur, dispositivo_id) -> dict:
    # Valida que exista el dispositivo y lo devuelve
    dispositivo = dispositivo_repo.buscar_por_id_publico(cur, dispositivo_id)
    if dispositivo is None:
        raise HTTPException(404, "dispositivo no existe")
    return dispositivo

def rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol) -> str | None:
    # 'admin' | 'owner' | 'editor' | 'viewer' | None (sin acceso). Admin
    # primero: es soporte, no pasa por usuario_dispositivo.
    if rol == "admin":
        return "admin"
    return acceso_repo.buscar_rol_en_dispositivo(cur, dispositivo_id, usuario_id)

def obtener_detalle_dispositivo(cur, dispositivo: dict, usuario_id, rol):
    dispositivo_id = dispositivo["id"]

    dispositivo["rol"] = rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
    dispositivo["owner_nombre"] = acceso_repo.buscar_nombre_owner(cur, dispositivo_id)
    limites = plan_service.limites_de_dispositivo(cur, dispositivo_id)
    dispositivo["limites"] = {
        "puede_alertas": limites["puede_alertas"],
        "max_alertas": limites["max_alertas"],
        "intervalo_minimo_seg": limites["intervalo_minimo_seg"],
        "intervalos_disponibles": intervalos_disponibles(limites["intervalo_minimo_seg"]),
    }
    dispositivo["intervalo_efectivo_seg"] = plan_service.intervalo_efectivo_seg(
        dispositivo["intervalo_configurado_seg"], limites["intervalo_minimo_seg"]
    )
    dispositivo["notificar"] = acceso_repo.buscar_notificar(cur, dispositivo_id, usuario_id)
    return dispositivo

#-----------------ENDPOINTS----------------------

def crear_dispositivo(dispositivo) -> dict:
    with get_cursor() as cur:
        return dispositivo_repo.crear(cur, dispositivo.nombre, dispositivo.ubicacion, dispositivo.descripcion)

def obtener_dispositivo(dispositivo_id, usuario_id, rol) -> dict:
    with get_cursor() as cur:
        dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return obtener_detalle_dispositivo(cur, dispositivo, usuario_id, rol)

def obtener_estado(dispositivo_id, usuario_id, rol) -> dict:
    # Lo único que cambia solo mientras se mira un equipo. El resto del detalle
    # sale de GET /dispositivos/{id}, que no hace falta pollear.
    with get_cursor() as cur:
        dispositivo = validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        last_seen_at = dispositivo["last_seen_at"]
        piso = plan_service.limites_de_dispositivo(cur, dispositivo_id)["intervalo_minimo_seg"]
        intervalo = plan_service.intervalo_efectivo_seg(dispositivo["intervalo_configurado_seg"], piso)
        return {
            "last_seen_at": last_seen_at,
            "last_data_at": dispositivo["last_data_at"],
            "online": esta_online(last_seen_at),
            "alertas_disparadas": len(alerta_repo.disparadas_por_dispositivos(cur, [dispositivo_id])),
            # Sigue colgando del intervalo de PUBLICACIÓN: es cuándo llega el
            # próximo dato, no cuándo vuelve a hablar el equipo.
            "siguiente_medicion": segundos_hasta_siguiente_medicion(dispositivo["last_data_at"], intervalo),
            "intervalo_modificado_at": dispositivo["intervalo_modificado_at"],
        }

def actualizar_datos(dispositivo_id, usuario_id, rol, datos):
    campos = datos.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(400, "No se enviaron campos para actualizar")
    
    with get_cursor() as cur:
        validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol)
        dispositivo = dispositivo_repo.actualizar(cur, dispositivo_id, campos)
        if campos.get("activo") is False:
            dispositivo_repo.limpiar_sin_reportar(cur, dispositivo_id)
        return obtener_detalle_dispositivo(cur, dispositivo, usuario_id, rol)

def obtener_sensores(dispositivo_id, usuario_id, rol) -> list[dict]:
    with get_cursor() as cur:
        validar_acceso_al_dispositivo(cur, dispositivo_id, usuario_id, rol)
        return sensor_repo.buscar_por_dispositivo_id(cur, dispositivo_id)

def configurar_notificaciones(dispositivo_id, usuario_id, notificar: bool) -> dict:
    # Opt-out de los mails de alerta de este equipo. Cualquier rol decide el
    # suyo (viewer incluido): no es una edición del equipo. El UPDATE acotado al
    # par (dispositivo, usuario) es a la vez la autorización — sin vínculo no
    # afecta ninguna fila.
    with get_cursor() as cur:
        if not acceso_repo.actualizar_notificar(cur, dispositivo_id, usuario_id, notificar):
            raise HTTPException(404, "No tenés acceso directo a este dispositivo")
    return {"notificar": notificar}

def intervalos_disponibles(piso: int) -> list[int]:
    # El piso del plan recorta la lista; el free queda con menos opciones y el
    # control se dibuja igual, sin caso especial.
    return [p for p in PRESETS_INTERVALO_SEG if p >= piso]

def configurar_intervalo(dispositivo_id, usuario_id, rol, intervalo_seg) -> dict:
    # Cambiar cada cuánto publica el dispositivo; viaja de vuelta como
    # intervalo_sugerido en la respuesta de /mediciones/.
    with get_cursor() as cur:
        validar_edicion_en_dispositivo(cur, dispositivo_id, usuario_id, rol)

        piso = plan_service.limites_de_dispositivo(cur, dispositivo_id)["intervalo_minimo_seg"]
        disponibles = intervalos_disponibles(piso)

        # None = automático, se queda con el piso del plan.
        if intervalo_seg is not None and intervalo_seg not in disponibles:
            raise HTTPException(400, f"Intervalos permitidos por tu plan: {disponibles}")

        dispositivo_repo.actualizar_intervalo(cur, dispositivo_id, intervalo_seg)
        efectivo = plan_service.intervalo_efectivo_seg(intervalo_seg, piso)

    return {"intervalo_configurado_seg": intervalo_seg, "intervalo_efectivo_seg": efectivo}

#------------SECRET-------------

def regenerar_secret_dispositivo(dispositivo_id) -> dict:
    # Uso solo de admin, reflashear firmware manualmente con secret nuevo
    with get_cursor() as cur:
        validar_que_exista_dispositivo(cur, dispositivo_id)
        secret = dispositivo_repo.actualizar_secret(cur, dispositivo_id)
        return {"secret": secret}

def marcar_rotacion_pendiente(dispositivo_id) -> dict:
    # Activar flag para que dispositivo rote de secret
    with get_cursor() as cur:
        dispositivo_repo.marcar_rotacion_pendiente(cur, dispositivo_id)
        return {"detail": "El dispositivo va a rotar su secret en la próxima conexión"}

def rotar_secret_dispositivo(dispositivo_id) -> dict:
    # Mismo dispositivo solicita rotar secret mediante una flag recibida
    with get_cursor() as cur:
        secret = dispositivo_repo.rotar_secret(cur, dispositivo_id)
        return {"secret": secret}
