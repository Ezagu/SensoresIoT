import { useCallback } from 'react'
import { useSesion } from './auth'
import {
  listarAlertas,
  listarDispositivos,
  listarSensores,
  listarTiposSensor,
  obtenerDispositivo,
  obtenerGrafico,
  obtenerHistorial,
} from './consultas'
import { etiquetarSensores } from './sensores'
import { useCarga } from './usarCarga'
import type {
  AlertaConNotificar,
  DatosGrafico,
  Dispositivo,
  DispositivoConRol,
  DispositivoDetalle,
  Medicion,
  TipoSensor,
} from './tipos'

/* Piso de muestreo si todavía no cargó el plan: sólo afecta al umbral con el
   que se decide "en línea", nunca a los datos. */
const INTERVALO_FALLBACK_SEG = 60

/* Misma cuenta que _obtener_intervalo_minimo: el plan es piso, no valor fijo.
   Se resuelve al renderizar y no al pedir los datos, porque el plan llega
   después de la sesión y meterlo en el fetch recargaría todo cuando aparece
   — el intervalo sólo decide el estado de conexión, no qué se pide.
   El piso real es el del DUEÑO del dispositivo y no se expone; hoy es exacto porque
   todo vínculo es 'owner'. */
export function intervaloEfectivo(dispositivo: Dispositivo, pisoPlan: number | undefined) {
  return Math.max(dispositivo.intervalo_configurado_seg ?? 0, pisoPlan ?? INTERVALO_FALLBACK_SEG)
}

/* El dispositivo puede no tener nombre cargado: el id corto lo distingue del resto
   sin obligar a mostrar un UUID entero. */
export function nombreDeDispositivo(id: string, nombre: string | null) {
  return nombre?.trim() || `Dispositivo ${id.slice(0, 8)}`
}

/* Sensor activo con su metadata resuelta (etiqueta/unidad/color por tipo), sin
   lecturas: es la parte común del fan-out del panel y del detalle, que después
   piden lecturas distintas. */
export type SensorConMeta = {
  id: string
  tipoSensorId: number
  etiqueta: string
  unidad: string
  color: string
}

export async function cargarSensoresConMeta(
  dispositivoId: string,
  tipos: TipoSensor[],
  signal: AbortSignal,
): Promise<{ sensores: SensorConMeta[]; alertas: AlertaConNotificar[] }> {
  const [sensores, alertas] = await Promise.all([
    listarSensores(dispositivoId, signal),
    listarAlertas(dispositivoId, signal),
  ])

  const activos = sensores.filter((s) => s.activo)
  const etiquetas = etiquetarSensores(activos, tipos)

  return {
    sensores: activos.map((sensor) => {
      const meta = etiquetas.get(sensor.id)
      return {
        id: sensor.id,
        tipoSensorId: sensor.tipo_sensor_id,
        etiqueta: meta?.etiqueta ?? 'Sensor',
        unidad: meta?.unidad ?? '',
        color: meta?.color ?? 'var(--color-text-muted)',
      }
    }),
    alertas,
  }
}

/* Lo que necesita el detalle: la metadata más el gráfico del rango. `datos` es
   null cuando el sensor no tiene lecturas en el rango o el request puntual
   falló: un sensor caído no puede tirar abajo el resto del dispositivo. */
export type SensorConDatos = SensorConMeta & { datos: DatosGrafico | null }

async function cargarSensoresDeDispositivo(
  dispositivoId: string,
  tipos: TipoSensor[],
  desde: Date,
  hasta: Date,
  signal: AbortSignal,
): Promise<{ sensores: SensorConDatos[]; alertas: AlertaConNotificar[] }> {
  const { sensores, alertas } = await cargarSensoresConMeta(dispositivoId, tipos, signal)

  const conDatos = await Promise.all(
    sensores.map(async (sensor): Promise<SensorConDatos> => {
      let datos: DatosGrafico | null = null
      try {
        datos = await obtenerGrafico(sensor.id, desde, hasta, signal)
      } catch {
        // Sensor sin lecturas o fallo puntual: se muestra vacío, no rompe el resto
      }
      return { ...sensor, datos }
    }),
  )

  return { sensores: conDatos, alertas }
}

// --------------------------------------------------------------------------
// Panel: todos los dispositivos, última lectura por sensor
// --------------------------------------------------------------------------

export type SensorPanel = {
  id: string
  etiqueta: string
  unidad: string
  color: string
  ultimo: number | null
  /* `time` de esa lectura. Con él cada fila resuelve por su cuenta si está
     desactualizada, sin que el last_seen_at del dispositivo tape a un sensor que
     se rompió mientras el resto sigue reportando. */
  ultimoAt: string | null
  disparada: boolean
}

export type DispositivoPanel = {
  dispositivo: DispositivoConRol
  sensores: SensorPanel[]
  alertasDisparadas: number
  /* El dispositivo se listó pero su detalle no cargó: se muestra igual, degradado */
  incompleto: boolean
}

const POLL_PANEL_MS = 60_000

/* Los dispositivos del panel con la última lectura de cada sensor.
   No hay endpoint agregado: es un fan-out de 2 requests por dispositivo más 1
   por sensor. Si aparecen carteras grandes, esto pide un /panel/resumen en el
   backend (una sola query con DISTINCT ON (sensor_id)) antes que paginado acá. */
export function useDispositivos() {
  const { sesion } = useSesion()
  const usuarioId = sesion?.usuario_id

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DispositivoPanel[]> => {
      if (!usuarioId) return []

      const [dispositivos, tipos] = await Promise.all([
        listarDispositivos(usuarioId, signal),
        listarTiposSensor(signal),
      ])

      return Promise.all(dispositivos.map((d) => cargarDispositivo(d, tipos, signal)))
    },
    [usuarioId],
  )

  return useCarga(cargar, { intervaloMs: POLL_PANEL_MS })
}

/* Para el detalle (BloqueAlertas): todas las reglas del sensor, activas o no
   — el usuario administra ambas. */
export function agruparAlertasPorSensor(alertas: AlertaConNotificar[]) {
  const mapa = new Map<string, AlertaConNotificar[]>()
  for (const alerta of alertas) {
    const acumuladas = mapa.get(alerta.sensor_id) ?? []
    acumuladas.push(alerta)
    mapa.set(alerta.sensor_id, acumuladas)
  }
  return mapa
}

/* Sólo reglas activas: el umbral del gráfico del detalle y el flag de
   disparada del panel. */
function reglasPorSensor(alertas: AlertaConNotificar[]) {
  const mapa = new Map<string, AlertaConNotificar[]>()
  for (const alerta of alertas) {
    if (!alerta.activa) continue
    const acumuladas = mapa.get(alerta.sensor_id) ?? []
    acumuladas.push(alerta)
    mapa.set(alerta.sensor_id, acumuladas)
  }
  return mapa
}

/* Regla a resaltar en el gráfico: la disparada si hay alguna, si no la primera
   activa. Mismo criterio en panel y detalle. */
export function reglaDestacada(alertas: AlertaConNotificar[], sensorId: string) {
  const reglas = reglasPorSensor(alertas).get(sensorId) ?? []
  return reglas.find((r) => r.estado === 'disparada') ?? reglas[0]
}

async function cargarDispositivo(
  dispositivo: DispositivoConRol,
  tipos: TipoSensor[],
  signal: AbortSignal,
): Promise<DispositivoPanel> {
  const base: DispositivoPanel = {
    dispositivo,
    sensores: [],
    alertasDisparadas: 0,
    incompleto: false,
  }

  let sensores: SensorConMeta[]
  let alertas: AlertaConNotificar[]
  try {
    ;({ sensores, alertas } = await cargarSensoresConMeta(dispositivo.id, tipos, signal))
  } catch {
    // Un dispositivo que falla no puede vaciar el panel entero
    return { ...base, incompleto: true }
  }

  const reglas = reglasPorSensor(alertas)

  const filas = await Promise.all(
    sensores.map(async (sensor): Promise<SensorPanel> => {
      let ultima: Medicion | undefined
      try {
        // limite=1 es la lectura cruda más reciente: sin ventana y sin promediar
        ultima = (await obtenerHistorial(sensor.id, { limite: 1 }, signal)).mediciones[0]
      } catch {
        // Sensor sin lecturas o fallo puntual: queda en —, no rompe el resto
      }
      const reglasDelSensor = reglas.get(sensor.id) ?? []

      return {
        id: sensor.id,
        etiqueta: sensor.etiqueta,
        unidad: sensor.unidad,
        color: sensor.color,
        ultimo: ultima?.value ?? null,
        ultimoAt: ultima?.time ?? null,
        disparada: reglasDelSensor.some((r) => r.estado === 'disparada'),
      }
    }),
  )

  return {
    ...base,
    sensores: filas,
    alertasDisparadas: alertas.filter((a) => a.activa && a.estado === 'disparada').length,
  }
}

// --------------------------------------------------------------------------
// Detalle: un dispositivo, gráfico completo por sensor en el rango elegido
// --------------------------------------------------------------------------

export type RangoGrafico = 'tiempo-real' | '24h' | '7d' | '30d' | '6m' | '1y'

/* Orden y etiquetas del selector de rango del detalle, en un solo lugar. */
export const RANGOS: { valor: RangoGrafico; etiqueta: string }[] = [
  { valor: 'tiempo-real', etiqueta: 'En tiempo real' },
  { valor: '24h', etiqueta: '24 h' },
  { valor: '7d', etiqueta: '7 d' },
  { valor: '30d', etiqueta: '30 d' },
  { valor: '6m', etiqueta: '6 m' },
  { valor: '1y', etiqueta: '1 y' },
]

const HORAS_POR_RANGO: Record<RangoGrafico, number> = { 'tiempo-real': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '6m': 24 * 30 * 6, '1y': 24 * 30 * 12 }

/* Margen para el desfase de reloj entre cliente y servidor: el backend calcula
   su piso de retención con su propio now() al atender el request, así que un
   `desde` que coincide justo con el borde del plan (free en 7 d) puede quedar
   unos milisegundos antes del piso real por pura latencia, no porque falten
   datos. `retencion_dias` null = sin límite (premium, y también admin, que
   está exento). */
const MARGEN_RELOJ_MS = 60_000

export function excedeRetencion(desde: Date, retencionDias: number | null) {
  if (retencionDias === null) return false
  const piso = Date.now() - retencionDias * 86400_000
  return desde.getTime() < piso - MARGEN_RELOJ_MS
}

/* Compatibilidad con el selector de sólo-presets del detalle de dispositivo. */
export function rangoExcedeRetencion(rango: RangoGrafico, retencionDias: number | null) {
  return excedeRetencion(new Date(Date.now() - HORAS_POR_RANGO[rango] * 3600_000), retencionDias)
}

export function duracionMsDeRango(rango: RangoGrafico): number {
  return HORAS_POR_RANGO[rango] * 3600_000
}

/* Un gráfico de 7 o 30 días no cambia de un minuto a otro: pollear cada 60 s
   sería puro gasto. El de 24 h sí se mueve seguido, mismo intervalo que el panel.
   "En tiempo real" refresca cada 15 s: es el modo pensado justo para ver el
   sensor moverse. */
const POLL_DETALLE_MS: Record<RangoGrafico, number> = {
  'tiempo-real': 15_000,
  '24h': 60_000,
  '7d': 300_000,
  '30d': 900_000,
  '6m': 300_000_000,
  '1y': 1_000_000_000
}

// --------------------------------------------------------------------------
// Ventana: preset o rango de fechas explícito, con la misma resolución para
// ambos casos. Preset sigue pollenado (se mueve solo); fechas explícitas no
// cambian, pollearlas sería gasto puro.
// --------------------------------------------------------------------------

export type Ventana =
  | { tipo: 'preset'; rango: RangoGrafico }
  | { tipo: 'fechas'; desde: Date; hasta: Date }

export function resolverVentana(v: Ventana): { desde: Date; hasta: Date } {
  if (v.tipo === 'fechas') return { desde: v.desde, hasta: v.hasta }
  const hasta = new Date()
  const desde = new Date(hasta.getTime() - HORAS_POR_RANGO[v.rango] * 3600_000)
  return { desde, hasta }
}

export function pollDeVentana(v: Ventana): number | undefined {
  return v.tipo === 'preset' ? POLL_DETALLE_MS[v.rango] : undefined
}

export type DetalleDispositivo = {
  dispositivo: DispositivoDetalle
  sensores: SensorConDatos[]
  alertas: AlertaConNotificar[]
}

/* Etiqueta de rol para el detalle de dispositivo (`DispositivoDetalle.rol`):
   'admin' sólo puede salir ahí, nunca de DispositivoConRol (listado del panel). */
export const ETIQUETA_ROL: Record<DispositivoDetalle['rol'], string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Solo lectura',
  admin: 'Administrador',
}

export function useDetalleDispositivo(dispositivoId: string, rango: RangoGrafico) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DetalleDispositivo> => {
      const [dispositivo, tipos] = await Promise.all([
        obtenerDispositivo(dispositivoId, signal),
        listarTiposSensor(signal),
      ])

      const hasta = new Date()
      const desde = new Date(hasta.getTime() - HORAS_POR_RANGO[rango] * 3600_000)

      const { sensores, alertas } = await cargarSensoresDeDispositivo(dispositivoId, tipos, desde, hasta, signal)
      return { dispositivo, sensores, alertas }
    },
    [dispositivoId, rango],
  )

  return useCarga(cargar, { intervaloMs: POLL_DETALLE_MS[rango] })
}
