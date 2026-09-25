// PENDIENTE: número, mail y dominio reales antes de publicar.
export const WHATSAPP_NUMERO = '5491100000000'
export const EMAIL_CONTACTO = 'hola@bitacora.com.ar'
export const APP_URL = 'https://app.bitacora.com.ar'

// PENDIENTE: datos de la empresa, todavía no existen.
export const RAZON_SOCIAL = 'Razón Social S.R.L.'
export const CUIT = '30-00000000-0'
export const UBICACION = 'Ciudad, Provincia'
export const HORARIO = 'Lunes a viernes, de 9 a 18 h'

// PENDIENTE: las páginas legales no existen todavía (href '#').
// Arrepentimiento: Res. 424/2020. Consumidor: Res. 38/2021 (verificar la URL
// vigente de la Ventanilla Única Federal antes de publicar).
export const LEGALES = [
  { texto: 'Términos y condiciones', href: '#' },
  { texto: 'Política de privacidad', href: '#' },
  { texto: 'Botón de arrepentimiento', href: '#' },
  { texto: 'Defensa de las y los consumidores. Para reclamos ingrese aquí', href: 'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario' },
]

export function linkWhatsApp(texto: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`
}

export function linkMail(asunto: string, cuerpo = ''): string {
  return `mailto:${EMAIL_CONTACTO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}
