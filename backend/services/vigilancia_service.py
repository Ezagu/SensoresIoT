from repositories import acceso_repo, alerta_repo, dispositivo_repo
from services import dispositivo_service
from db import get_cursor, tomar_lock_de_transaccion

# Arbitraria pero fija: identifica al barrido, no a un dispositivo.
LOCK_VIGILANCIA = 4831001

def barrer() -> list[dict]:
    """
    Abre y cierra caídas de conectividad, y devuelve las notificaciones a mandar.

    Una sola transacción para todo el barrido, y los mails van DESPUÉS del commit:
    si el barrido falla a la mitad, rollea entero y no se mandó nada, así que el
    próximo tick reintenta limpio.
    """
    with get_cursor() as cur:
        if not tomar_lock_de_transaccion(cur, LOCK_VIGILANCIA):
            return []  # otro proceso está barriendo

        candidatos = dispositivo_repo.candidatos_de_vigilancia(
            cur, dispositivo_service.VENTANA_SIN_REPORTAR_SEG
        )
        if not candidatos:
            return []

        eventos = []
        contexto = {}

        for dispositivo in candidatos:
            ahora = dispositivo["ahora"]
            online = dispositivo_service.esta_online(dispositivo["last_seen_at"], ahora)
            abierta = dispositivo["sin_reportar_desde"]

            if abierta is None and not online:
                # medicion_at es el instante de detección y no last_seen_at: el log
                # se ordena por medicion_at, y fechar el evento cuando empezó el
                # silencio lo entierra páginas atrás justo el día que llega el mail.
                if not dispositivo_repo.abrir_sin_reportar(cur, dispositivo["id"], dispositivo["last_seen_at"]):
                    continue
                silencio_desde = dispositivo["last_seen_at"]
                tipo, medicion_at = "sin_reportar", ahora
            elif abierta is not None and online:
                if not dispositivo_repo.cerrar_sin_reportar(cur, dispositivo["id"], abierta):
                    continue
                silencio_desde = abierta
                tipo, medicion_at = "reconectado", dispositivo["last_seen_at"]
            else:
                continue

            eventos.append((dispositivo["id"], tipo, medicion_at, ahora, silencio_desde))
            contexto[dispositivo["id"]] = {
                "tipo": tipo,
                "dispositivo_id": dispositivo["id"],
                "dispositivo_nombre": dispositivo["nombre"],
                "silencio_desde": silencio_desde,
                "medicion_at": medicion_at,
            }

        if not eventos:
            return []

        notificaciones = []
        for insertado in alerta_repo.insertar_eventos_de_conectividad(cur, eventos):
            dispositivo_id = insertado["dispositivo_id"]
            destinatarios = acceso_repo.destinatarios(cur, dispositivo_id)
            alerta_repo.actualizar_destinatarios(cur, insertado["id"], len(destinatarios))
            notificaciones.append({
                **contexto[dispositivo_id],
                "evento_id": insertado["id"],
                "destinatarios": destinatarios,
            })

    return notificaciones
