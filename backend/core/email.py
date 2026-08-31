import resend
from core.config import FRONTEND_URL, RESEND_API_KEY

resend.api_key = RESEND_API_KEY

REMITENTE = "onboarding@resend.dev"

def enviar_email_verificacion(to: str, token:str):
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