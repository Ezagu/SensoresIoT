from repositories import acceso_repo, alerta_repo, dispositivo_repo
from services import dispositivo_service, medicion_service
from db import get_cursor

# La falla silenciosa —el equipo se muere y nadie se entera— es la única que no
# se puede evaluar inline en crear_medicion, porque se dispara por la AUSENCIA de
# un POST. De ahí el barrido periódico, que es lo único de fondo del backend.

# Durante el arranque rápido no se abre ninguna caída. Importado y no copiado:
# si los dos números se separan, el barrido contradice al ingreso.
VENTANA_ARRANQUE_SEG = int(medicion_service.VENTANA_ARRANQUE.total_seconds())

def barrer() -> list[dict]:
    """
    Abre y cierra caídas de conectividad, y devuelve las notificaciones a mandar.

    Una sola transacción para todo el barrido, y los mails van DESPUÉS del commit:
    si el barrido falla a la mitad, rollea entero y no se mandó nada, así que el
    próximo tick reintenta limpio. Con un commit por equipo, una falla dejaría
    medio lote con la caída marcada y sin mail, que es el peor resultado posible
    acá — silencio permanente sobre un equipo caído.
    """
    with get_cursor() as cur:
        if not dispositivo_repo.tomar_lock_vigilancia(cur):
            return []  # otro proceso está barriendo

        candidatos = dispositivo_repo.candidatos_de_vigilancia(
            cur, dispositivo_service.VENTANA_SIN_REPORTAR_SEG, VENTANA_ARRANQUE_SEG
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
