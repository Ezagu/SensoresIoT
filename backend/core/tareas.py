import asyncio
from contextlib import asynccontextmanager, suppress
from services import alerta_service, vigilancia_service

INTERVALO_BARRIDO_SEG = 60

# Los endpoints de la app son todos sync y psycopg2 es bloqueante, así que el
# barrido corre en un thread: dentro del event loop taparía a todo el mundo.
#
# Que arranque demorado cubre dos cosas: que la base termine de levantar, y el
# ruido de --reload en dev, donde cada guardado reinicia el proceso y sin esto
# diez ediciones seguidas disparan diez barridos.
DEMORA_INICIAL_SEG = 30

# Si el shutdown llega mientras el thread está adentro de un send de Resend no hay
# forma de cancelarlo (to_thread no es cancelable), así que se lo espera un rato y
# se sigue: el thread es del executor y no impide salir.
ESPERA_APAGADO_SEG = 5

async def _bucle_vigilancia():
    await asyncio.sleep(DEMORA_INICIAL_SEG)
    while True:
        # El try va ADENTRO del while: una excepción que se escape mata la tarea y
        # nadie se entera —la API sigue respondiendo 200 a todo—, o sea la falla
        # silenciosa del detector de fallas silenciosas.
        try:
            notificaciones = await asyncio.to_thread(vigilancia_service.barrer)
            if notificaciones:
                await asyncio.to_thread(alerta_service.notificar_eventos, notificaciones)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"Error en el barrido de vigilancia: {e}")
        # Después del trabajo y no en paralelo: un barrido lento no apila dos.
        await asyncio.sleep(INTERVALO_BARRIDO_SEG)

@asynccontextmanager
async def ciclo_de_vida(app):
    tarea = asyncio.create_task(_bucle_vigilancia())
    try:
        yield
    finally:
        tarea.cancel()
        with suppress(asyncio.CancelledError, asyncio.TimeoutError):
            await asyncio.wait_for(tarea, timeout=ESPERA_APAGADO_SEG)
