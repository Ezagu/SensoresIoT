// PENDIENTE: número, mail y dominio reales antes de publicar.
export const WHATSAPP_NUMERO = '5491100000000'
export const EMAIL_CONTACTO = 'hola@bitacora.com.ar'
export const APP_URL = 'https://app.bitacora.com.ar'

export function linkWhatsApp(texto: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`
}

export function linkMail(asunto: string, cuerpo = ''): string {
  return `mailto:${EMAIL_CONTACTO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}
