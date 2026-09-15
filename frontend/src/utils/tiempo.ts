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

/* Sólo la hora con segundos: en una tabla agrupada por día, la fecha ya la dice
   el encabezado del grupo y repetirla en cada fila es ruido que además se come
   el ancho útil en mobile. */
export function horaSegundos(iso: string): string {
  return fmtHoraSeg.format(new Date(iso))
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
/* Cuenta regresiva corta: "45 s" abajo del minuto, "2:14" arriba. */
export function cuentaRegresiva(segundos: number): string {
  if (segundos < 60) return `${segundos} s`
  const minutos = Math.floor(segundos / 60)
  return `${minutos}:${String(segundos % 60).padStart(2, '0')}`
}

export const TIC_RELOJ_MS = 30_000

export type EstadoDispositivo = 'nunca' | 'en-linea' | 'con-retraso' | 'sin-reportar'

/* Un equipo tiene tres estados, no dos. Entre "reportó recién" y "lo damos por
   caído" hay una banda donde la lectura esperada no llegó pero el equipo está
   bufferreando y se va a poner al día solo: colapsarla en "sin reportar"
   convierte el comportamiento normal de una conexión intermitente en una falla.
   Media cadencia de tolerancia: sin ella, todo equipo sano entraría en retraso
   una vez por ciclo, justo antes de su próximo reporte. La banda va de 1,5 a los
   3 intervalos de gracia con los que el backend decide `online`. */
const INTERVALOS_DE_RETRASO = 1.5

/* Si el equipo está vivo o no lo decide el backend y no esta función: acá sólo
   se reparte esa respuesta en los estados que la interfaz muestra distinto. Un
   único criterio para panel, inventario y detalle. */
export function estadoDispositivo(
  lastSeenAt: string | null,
  online: boolean,
  intervaloSeg: number,
  ahora: number = Date.now(),
): EstadoDispositivo {
  if (!lastSeenAt) return 'nunca'
  if (!online) return 'sin-reportar'
  const seg = (ahora - new Date(lastSeenAt).getTime()) / 1000
  return seg >= intervaloSeg * INTERVALOS_DE_RETRASO ? 'con-retraso' : 'en-linea'
}

/* Otra pregunta que `estadoDispositivo`: no es "¿el equipo está vivo?" sino
   "¿esta lectura ya debería haber sido reemplazada?". El backend resuelve la
   primera, pero no expone frescura por sensor, así que ésta se deriva acá.
   Mismos 3 intervalos de gracia que `dispositivo_service.INTERVALOS_DE_GRACIA`. */
export function lecturaDesactualizada(
  ultimoAt: string | null,
  intervaloSeg: number,
  ahora: number = Date.now(),
): boolean {
  if (!ultimoAt) return true
  return (ahora - new Date(ultimoAt).getTime()) / 1000 >= intervaloSeg * 3
}

export const ETIQUETA_ESTADO: Record<EstadoDispositivo, string> = {
  nunca: 'Nunca reportó',
  'en-linea': 'En línea',
  'con-retraso': 'Con retraso',
  'sin-reportar': 'Sin reportar',
}
