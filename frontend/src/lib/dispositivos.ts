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
type SensorConMeta = {
  id: string
  tipoSensorId: number
  etiqueta: string
  unidad: string
  color: string
}

async function cargarSensoresConMeta(
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

export type RangoGrafico = '24h' | '7d' | '30d' | '6m' | '1y'

/* Orden y etiquetas del selector de rango del detalle, en un solo lugar. */
export const RANGOS: { valor: RangoGrafico; etiqueta: string }[] = [
  { valor: '24h', etiqueta: '24 h' },
  { valor: '7d', etiqueta: '7 d' },
  { valor: '30d', etiqueta: '30 d' },
  { valor: '6m', etiqueta: '6 m' },
  { valor: '1y', etiqueta: '1 y' },
]

const HORAS_POR_RANGO: Record<RangoGrafico, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '6m': 24 * 30 * 6, '1y': 24 * 30 * 12 }

/* Si el rango pedido entra en la retención del plan, no hay recorte que avisar.
   No se usa el `recortado` de la respuesta para esto: el backend calcula su piso
   con su propio now() al atender el request, así que para un rango igual a la
   retención (free en 7 d) el piso siempre queda unos milisegundos por delante
   del `desde` que mandó el cliente y el flag da true por latencia y desfase de
   reloj, no porque falten datos. Comparar duración contra retención es exacto y
   no mete relojes de por medio. `retencion_dias` null = sin límite (premium, y
   también admin, que está exento). */
export function rangoExcedeRetencion(rango: RangoGrafico, retencionDias: number | null) {
  return retencionDias !== null && HORAS_POR_RANGO[rango] > retencionDias * 24
}

/* Un gráfico de 7 o 30 días no cambia de un minuto a otro: pollear cada 60 s
   sería puro gasto. El de 24 h sí se mueve seguido, mismo intervalo que el panel. */
const POLL_DETALLE_MS: Record<RangoGrafico, number> = {
  '24h': 60_000,
  '7d': 300_000,
  '30d': 900_000,
  '6m': 300_000_000,
  '1y': 1_000_000_000
}

export type DetalleDispositivo = {
  dispositivo: Dispositivo
  sensores: SensorConDatos[]
  alertas: AlertaConNotificar[]
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
