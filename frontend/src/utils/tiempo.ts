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

const fmtHoraSeg = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function haceCuanto(iso: string | null, ahora: number = Date.now()): string {
  if (!iso) return 'nunca'
  const seg = Math.round((ahora - new Date(iso).getTime()) / 1000)
  /* Un timestamp futuro es un reloj desfasado, no un dato del futuro. */
  if (seg <= 0) return 'recién'
  if (seg < 60) return `hace ${seg} s`
  if (seg < 3600) return rtf.format(-Math.round(seg / 60), 'minute')
  if (seg < 86400) return rtf.format(-Math.round(seg / 3600), 'hour')
  return rtf.format(-Math.round(seg / 86400), 'day')
}

export function fecha(iso: string): string {
  return fmtFecha.format(new Date(iso))
}

export function fechaHora(iso: string): string {
  return fechaHoraMs(new Date(iso).getTime())
}

/* Los formatters del eje X omiten el año o la hora; donde no hay ticks alrededor
   que desambigüen hace falta el timestamp entero. */
export function fechaHoraMs(ms: number): string {
  const d = new Date(ms)
  return `${fmtFecha.format(d)} ${fmtHora.format(d)}`
}

/* Con segundos: estos equipos muestrean cada 15-30 s y al minuto dos filas
   seguidas se leerían como duplicadas. */
export function fechaHoraSegundos(iso: string): string {
  const d = new Date(iso)
  return `${fmtFecha.format(d)} ${fmtHoraSeg.format(d)}`
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

/* Día, mes y año: eje X para ventanas de más de un año, donde omitir el año
   vuelve ambiguo a qué vuelta del calendario pertenece cada tick. */
export function fechaConAnio(ms: number): string {
  return fmtFecha.format(new Date(ms))
}

/* Nunca más lento que el poll más rápido en pantalla, para que estos textos no
   envejezcan entre un poll y el siguiente. */
export const TIC_RELOJ_MS = 30_000

export type EstadoDispositivo = 'nunca' | 'en-linea' | 'retraso' | 'sin-reportar'

/* No existe online/offline en el backend: se deriva de last_seen_at, que es el
   now() del servidor en cada POST aceptado, nunca el time de la lectura. Tres
   estados y no un booleano porque estos equipos pierden WiFi, bufferean y se
   ponen al día: "con retraso" casi nunca es una falla. */
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
  nunca: 'Nunca reportó',
  'en-linea': 'En línea',
  retraso: 'Con retraso',
  'sin-reportar': 'Sin reportar',
}
