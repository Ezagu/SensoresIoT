const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto', style: 'narrow' })
const fmtFecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtFechaCorta = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })
/* hourCycle h23 y no el default de es-AR: son datos de instrumental, y "02:35"
   sin am/pm no se puede confundir con las 14:35 al leer un eje o un evento. */
const fmtHora = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function haceCuanto(iso: string | null): string {
  if (!iso) return 'nunca'
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seg < 60) return `hace ${seg} s`
  if (seg < 3600) return rtf.format(-Math.round(seg / 60), 'minute')
  if (seg < 86400) return rtf.format(-Math.round(seg / 3600), 'hour')
  return rtf.format(-Math.round(seg / 86400), 'day')
}

export function fecha(iso: string): string {
  return fmtFecha.format(new Date(iso))
}

export function fechaHora(iso: string): string {
  const d = new Date(iso)
  return `${fmtFecha.format(d)} ${fmtHora.format(d)}`
}

/* Sólo la hora, para el eje X del gráfico en el rango de 24 h (la fecha ahí es
   ruido: todo el rango cae en el mismo día o el anterior). */
export function hora(ms: number): string {
  return fmtHora.format(new Date(ms))
}

/* Sólo día y mes, para el eje X en 7 d / 30 d (mismo criterio: la hora y el
   año son ruido cuando cada tick representa un día entero). */
export function fechaCorta(ms: number): string {
  return fmtFechaCorta.format(new Date(ms))
}

export type EstadoDispositivo = 'nunca' | 'en-linea' | 'retraso' | 'sin-reportar'

/* No existe online/offline en el backend: se deriva de last_seen_at, que es el
   now() del servidor en cada POST aceptado (nunca el time de la lectura, para
   que un flush de datos viejos no marque como caído a un dispositivo que acaba de
   reportar).
   Tres estados y no un booleano porque así fallan estos dispositivos: pierden WiFi,
   bufferean y se ponen al día — "con retraso" casi nunca es una falla real.
   El piso real sale del plan del DUEÑO y no se expone, así que intervaloSeg es
   una aproximación; hoy es exacta porque todo vínculo es 'owner'. */
export function estadoDispositivo(
  lastSeenAt: string | null,
  intervaloSeg: number,
  ahora: number = Date.now(),
): EstadoDispositivo {
  if (!lastSeenAt) return 'nunca'
  const transcurrido = (ahora - new Date(lastSeenAt).getTime()) / 1000
  if (transcurrido < intervaloSeg * 3) return 'en-linea'
  if (transcurrido < intervaloSeg * 12) return 'retraso'
  return 'sin-reportar'
}

export const ETIQUETA_ESTADO: Record<EstadoDispositivo, string> = {
  nunca: 'Nunca conectado',
  'en-linea': 'En línea',
  retraso: 'Con retraso',
  'sin-reportar': 'Sin reportar',
}

export function isoDesdeAhora(horas: number): string {
  return new Date(Date.now() - horas * 3600 * 1000).toISOString()
}
