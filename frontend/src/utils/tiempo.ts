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

/* Cuánto duró algo, entre dos instantes. No es `haceCuanto`: ese contesta "qué
   tan viejo es esto" contra el reloj y redondea a una sola unidad, y acá la
   segunda unidad es el dato ("4 h 12 min" de corte, no "hace 4 horas"). */
export function duracion(desdeIso: string, hastaIso: string): string {
  const minutos = Math.max(1, Math.floor((new Date(hastaIso).getTime() - new Date(desdeIso).getTime()) / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas < 24) return resto ? `${horas} h ${resto} min` : `${horas} h`
  const dias = Math.floor(horas / 24)
  return horas % 24 ? `${dias} d ${horas % 24} h` : `${dias} d`
}

export const TIC_RELOJ_MS = 30_000

export type EstadoDispositivo = 'nunca' | 'en-linea' | 'con-retraso' | 'sin-reportar'

/* Un equipo tiene tres estados, no dos. Entre "reportó recién" y "lo damos por
   caído" hay una banda donde la lectura esperada no llegó pero el equipo está
   bufferreando y se va a poner al día solo: colapsarla en "sin reportar"
   convierte el comportamiento normal de una conexión intermitente en una falla.
   Media cadencia de tolerancia: sin ella, todo equipo sano entraría en retraso
   una vez por ciclo, justo antes de su próximo reporte. */
const INTERVALOS_DE_RETRASO = 1.5

/* Espeja `dispositivo_service.INTERVALO_CONTACTO_SEG`: cada cuánto el equipo
   habla, publique o no. Acá sólo se usa para acotar cuánto puede tardar en
   enterarse de un cambio de intervalo. */
const CONTACTO_SEG = 300

type Conectividad = {
  /* Cuándo habló (incluye heartbeats) -> ¿está vivo? Lo resuelve el backend. */
  last_seen_at: string | null
  online: boolean
  /* Cuándo mandó datos -> ¿llegan a tiempo? Con heartbeat cada 5 min, last_seen_at
     ya no sabe nada de esto: un equipo con el bus I2C muerto sigue hablando. */
  last_data_at: string | null
  intervalo_efectivo_seg: number
  intervalo_modificado_at: string | null
}

/* Si el equipo está vivo o no lo decide el backend y no esta función: acá sólo
   se reparte esa respuesta en los estados que la interfaz muestra distinto. Un
   único criterio para panel, inventario y detalle. */
export function estadoDispositivo(d: Conectividad, ahora: number = Date.now()): EstadoDispositivo {
  if (!d.last_seen_at) return 'nunca'
  if (!d.online) return 'sin-reportar'
  if (!d.last_data_at) return 'con-retraso'

  const seg = (ahora - new Date(d.last_data_at).getTime()) / 1000
  if (seg < d.intervalo_efectivo_seg * INTERVALOS_DE_RETRASO) return 'en-linea'

  /* El equipo se entera del intervalo nuevo recién en su próximo contacto y hasta
     entonces publica con el viejo. Sin esta gracia, bajar de 5 min a 1 min pone el
     equipo en amarillo al instante — justo cuando quien lo cambió está mirando.
     El heartbeat acota esa ignorancia a CONTACTO_SEG para cualquier transición,
     así que no hace falta conocer el intervalo anterior. */
  if (d.intervalo_modificado_at) {
    const graciaSeg = CONTACTO_SEG + d.intervalo_efectivo_seg * INTERVALOS_DE_RETRASO
    const desdeCambio = (ahora - new Date(d.intervalo_modificado_at).getTime()) / 1000
    if (desdeCambio < graciaSeg) return 'en-linea'
  }

  return 'con-retraso'
}

/* Otra pregunta que `estadoDispositivo`: no es "¿el equipo está vivo?" sino
   "¿esta lectura ya debería haber sido reemplazada?". Se deriva acá porque el
   backend expone frescura por equipo (last_data_at) pero no por sensor. */
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

function diasAtras(ms: number, ahora: number): number {
  const dia = (x: number) => {
    const d = new Date(x)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  return Math.round((dia(ahora) - dia(ms)) / 86_400_000)
}

/* Un instante reciente como se dice en voz alta: "hoy 19:08", "ayer 23:05",
   "12 sept 10:00". */
export function momento(iso: string, ahora: number = Date.now()): string {
  const ms = new Date(iso).getTime()
  const dias = diasAtras(ms, ahora)
  if (dias === 0) return `hoy ${hora(ms)}`
  if (dias === 1) return `ayer ${hora(ms)}`
  return `${fechaCorta(ms)} ${hora(ms)}`
}

/* Para cerrar "desde …" o "… a las …": "las 18:42", "ayer a las 18:42",
   "el 12 sept a las 18:42". */
export function aLas(iso: string, ahora: number = Date.now()): string {
  const ms = new Date(iso).getTime()
  const dias = diasAtras(ms, ahora)
  if (dias === 0) return `las ${hora(ms)}`
  if (dias === 1) return `ayer a las ${hora(ms)}`
  return `el ${fechaCorta(ms)} a las ${hora(ms)}`
}

/* Una duración en ms como se lee en una métrica: "1 h 44 min", "38 min", "2 d 3 h". */
export function duracionMs(ms: number): string {
  return duracion(new Date(0).toISOString(), new Date(ms).toISOString())
}
