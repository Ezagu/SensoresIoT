import resend
from core.config import FRONTEND_URL, RESEND_API_KEY

resend.api_key = RESEND_API_KEY

REMITENTE = "onboarding@resend.dev"

def _sin_configurar() -> bool:
    # Sin API key cada send explota y el llamador lo atrapa, así que el efecto es
    # el mismo. Salir antes evita pintar de rojo el registro de avisos en dev y
    # llenar la consola con una excepción por destinatario cada 60 s.
    if RESEND_API_KEY:
        return False
    print("RESEND_API_KEY sin definir: no se manda el mail")
    return True

def enviar_email_verificacion(to: str, token:str):
    if _sin_configurar():
        return
    verify_link = f"{FRONTEND_URL}/verify?token={token}"
    resend.Emails.send({
        "from": REMITENTE,
        "to": [to],
        "subject": "Confirmá tu cuenta",
        "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Confirmá tu cuenta</h2>
                <p>Hacé click en el siguiente botón para verificar tu email:</p>
                <a href="{verify_link}"
                    style="display:inline-block; padding:12px 24px; background:#111;
                    color:#fff; text-decoration:none; border-radius:6px;"
                >
                    Verificar email
                </a>
                <p style="color:#666; font-size:13px; margin-top:24px;">
                    Este link expira en 24 horas. Si no creaste esta cuenta, ignorá este mail.
                </p>
            </div>
        """
    })

def enviar_email_alerta(to: str, notificacion: dict):
    if _sin_configurar():
        return
    disparada = notificacion["tipo"] == "disparada"
    condicion_texto = "por encima de" if notificacion["condicion"] == "mayor" else "por debajo de"
    nombre_regla = notificacion["alerta_nombre"] or notificacion["tipo_sensor_nombre"]

    asunto = (
        f"⚠️ {nombre_regla}: {notificacion['tipo_sensor_nombre']} en {notificacion['dispositivo_nombre']}"
        if disparada else
        f"✅ {nombre_regla}: normalizado en {notificacion['dispositivo_nombre']}"
    )

    aviso_tardio = ""
    if notificacion["tardio"]:
        aviso_tardio = f"""
            <p style="color:#b45309; font-size:13px;">
                El equipo reportó este dato con retraso: ocurrió el {notificacion['medicion_at']}.
            </p>
        """

    aviso_episodios = ""
    if notificacion["cantidad_episodios"] > 1:
        aviso_episodios = f"""
            <p style="color:#666; font-size:13px;">
                Hubo {notificacion['cantidad_episodios']} episodios en este período; este mail
                corresponde sólo al último.
            </p>
        """

    cuerpo = (
        f"""
            <p><strong>{notificacion['tipo_sensor_nombre']}</strong> en
            <strong>{notificacion['dispositivo_nombre']}</strong> está
            {condicion_texto} {notificacion['umbral']} {notificacion['tipo_sensor_unidad']}.</p>
            <p>Valor medido: {notificacion['valor']} {notificacion['tipo_sensor_unidad']}</p>
        """
        if disparada else
        f"""
            <p><strong>{notificacion['tipo_sensor_nombre']}</strong> en
            <strong>{notificacion['dispositivo_nombre']}</strong> volvió a la normalidad.</p>
            <p>Valor medido: {notificacion['valor']} {notificacion['tipo_sensor_unidad']}</p>
        """
    )

    resend.Emails.send({
        "from": REMITENTE,
        "to": [to],
        "subject": asunto,
        "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>{asunto}</h2>
                {cuerpo}
                {aviso_tardio}
                {aviso_episodios}
            </div>
        """
    })

def _duracion(desde, hasta) -> str:
    minutos = max(1, int((hasta - desde).total_seconds() // 60))
    if minutos < 60:
        return f"{minutos} min"
    horas, minutos = divmod(minutos, 60)
    if horas < 24:
        return f"{horas} h {minutos} min" if minutos else f"{horas} h"
    dias, horas = divmod(horas, 24)
    return f"{dias} d {horas} h" if horas else f"{dias} d"

def enviar_email_sin_reportar(to: str, aviso: dict):
    # El aviso de que un equipo se quedó mudo (o volvió). No es una regla sobre un
    # sensor: no hay umbral ni valor, y lo único que importa es cuánto lleva.
    if _sin_configurar():
        return

    corte = aviso["tipo"] == "sin_reportar"
    nombre = aviso["dispositivo_nombre"]
    silencio = _duracion(aviso["silencio_desde"], aviso["medicion_at"])
    link = f"{FRONTEND_URL}/dispositivos/{aviso['dispositivo_id']}"

    asunto = (
        f"⚠️ {nombre} dejó de reportar"
        if corte else
        f"✅ {nombre} volvió a reportar"
    )

    cuerpo = (
        f"""
            <p><strong>{nombre}</strong> no manda datos desde hace {silencio}.</p>
            <p>Mientras esté mudo no se evalúa ninguna de sus alertas.
            Revisá que tenga corriente y que la red donde está configurado siga
            disponible.</p>
        """
        if corte else
        f"""
            <p><strong>{nombre}</strong> volvió a reportar después de {silencio}
            sin datos.</p>
            <p>Las lecturas que haya tomado durante el corte las guardó y las manda
            solo, así que el historial se completa en los próximos minutos.</p>
        """
    )

    resend.Emails.send({
        "from": REMITENTE,
        "to": [to],
        "subject": asunto,
        "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>{asunto}</h2>
                {cuerpo}
                <a href="{link}"
                    style="display:inline-block; padding:12px 24px; background:#111;
                    color:#fff; text-decoration:none; border-radius:6px;"
                >
                    Ver el equipo
                </a>
            </div>
        """
    })
