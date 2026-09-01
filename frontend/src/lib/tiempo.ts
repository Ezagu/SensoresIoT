const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto', style: 'narrow' })
const fmtFecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })

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

export type EstadoDispositivo = 'nunca' | 'en-linea' | 'retraso' | 'sin-reportar'

/* No existe online/offline en el backend: se deriva de last_seen_at, que es el
   now() del servidor en cada POST aceptado (nunca el time de la lectura, para
   que un flush de datos viejos no marque como caído a un equipo que acaba de
   reportar).
   Tres estados y no un booleano porque así fallan estos equipos: pierden WiFi,
   bufferean y se ponen al día — "con retraso" casi nunca es una falla real.
   El piso real sale del plan del DUEÑO y no se expone, así que intervaloSeg es
   una aproximación; hoy es exacta porque todo vínculo es 'owner'. */
export function estadoDispositivo(
  lastSeenAt: string | null,
  intervaloSeg: number,
): EstadoDispositivo {
  if (!lastSeenAt) return 'nunca'
  const transcurrido = (Date.now() - new Date(lastSeenAt).getTime()) / 1000
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
