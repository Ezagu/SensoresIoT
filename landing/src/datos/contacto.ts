// PENDIENTE: número y dominio reales antes de publicar.
export const WHATSAPP_NUMERO = '5491100000000'
export const APP_URL = 'https://app.bitacora.com.ar'

export function linkWhatsApp(texto: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`
}
