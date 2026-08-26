import resend
from core.config import FRONTEND_URL, RESEND_API_KEY

resend.api_key = RESEND_API_KEY

def enviar_email_verificacion(to: str, token:str):
    verify_link = f"{FRONTEND_URL}/verify?token={token}"
    resend.Emails.send({
        "from": "onboarding@resend.dev",
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