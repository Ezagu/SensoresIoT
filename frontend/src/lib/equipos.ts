import { useCallback } from 'react'
import { useSesion } from './auth'
import {
  listarAlertas,
  listarDispositivos,
  listarSensores,
  listarTiposSensor,
  obtenerGrafico,
} from './consultas'
import { etiquetarSensores } from './sensores'
import { serieDeGrafico } from './series'
import { useCarga } from './usarCarga'
import type { AlertaConNotificar, CondicionAlerta, Dispositivo, Sensor, TipoSensor } from './tipos'

const VENTANA_HORAS = 24
/* Piso de muestreo si todavía no cargó el plan: sólo afecta al umbral con el
   que se decide "en línea", nunca a los datos. */
const INTERVALO_FALLBACK_SEG = 60

export type SensorPanel = {
  id: string
  etiqueta: string
  unidad: string
  color: string
  ultimo: number | null
  serie: (number | null)[]
  umbral: number | null
  condicion: CondicionAlerta | null
  disparada: boolean
}

export type Equipo = {
  dispositivo: Dispositivo
  sensores: SensorPanel[]
  alertasDisparadas: number
  /* El equipo se listó pero su detalle no cargó: se muestra igual, degradado */
  incompleto: boolean
}

/* Los equipos del panel con sus últimas 24 h por sensor.
   No hay endpoint agregado: es un fan-out de 2 requests por dispositivo más 1
   por sensor. Si aparecen carteras grandes, esto pide un /panel/resumen en el
   backend antes que paginado acá. */
export function useEquipos() {
  const { sesion } = useSesion()
  const usuarioId = sesion?.usuario_id

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<Equipo[]> => {
      if (!usuarioId) return []

      const [dispositivos, tipos] = await Promise.all([
        listarDispositivos(usuarioId, signal),
        listarTiposSensor(signal),
      ])

      const hasta = new Date()
      const desde = new Date(hasta.getTime() - VENTANA_HORAS * 3600_000)

      return Promise.all(dispositivos.map((d) => cargarEquipo(d, tipos, desde, hasta, signal)))
    },
    [usuarioId],
  )

  return useCarga(cargar)
}

/* Misma cuenta que _obtener_intervalo_minimo: el plan es piso, no valor fijo.
   Se resuelve al renderizar y no al pedir los datos, porque el plan llega
   después de la sesión y meterlo en el fetch recargaría el panel entero cuando
   aparece — el intervalo sólo decide el estado de conexión, no qué se pide.
   El piso real es el del DUEÑO del equipo y no se expone; hoy es exacto porque
   todo vínculo es 'owner'. */
export function intervaloEfectivo(dispositivo: Dispositivo, pisoPlan: number | undefined) {
  return Math.max(dispositivo.intervalo_configurado_seg ?? 0, pisoPlan ?? INTERVALO_FALLBACK_SEG)
}

async function cargarEquipo(
  dispositivo: Dispositivo,
  tipos: TipoSensor[],
  desde: Date,
  hasta: Date,
  signal: AbortSignal,
): Promise<Equipo> {
  const base: Equipo = {
    dispositivo,
    sensores: [],
    alertasDisparadas: 0,
    incompleto: false,
  }

  let sensores: Sensor[]
  let alertas: AlertaConNotificar[]
  try {
    ;[sensores, alertas] = await Promise.all([
      listarSensores(dispositivo.id, signal),
      listarAlertas(dispositivo.id, signal),
    ])
  } catch {
    // Un equipo que falla no puede vaciar el panel entero
    return { ...base, incompleto: true }
  }

  const activos = sensores.filter((s) => s.activo)
  const etiquetas = etiquetarSensores(activos, tipos)

  const reglasPorSensor = new Map<string, AlertaConNotificar[]>()
  for (const alerta of alertas) {
    if (!alerta.activa) continue
    const acumuladas = reglasPorSensor.get(alerta.sensor_id) ?? []
    acumuladas.push(alerta)
    reglasPorSensor.set(alerta.sensor_id, acumuladas)
  }

  const filas = await Promise.all(
    activos.map(async (sensor): Promise<SensorPanel> => {
      const meta = etiquetas.get(sensor.id)
      const reglas = reglasPorSensor.get(sensor.id) ?? []
      // Se dibuja la regla disparada; si ninguna lo está, la primera activa
      const regla = reglas.find((r) => r.estado === 'disparada') ?? reglas[0]

      let serie: (number | null)[] = []
      let ultimo: number | null = null
      try {
        const datos = await obtenerGrafico(sensor.id, desde, hasta, signal)
        serie = serieDeGrafico(datos, hasta)
        // Promedio del último bucket, no la última medición cruda: alcanza para
        // el tile y ahorra un request de historial por sensor
        ultimo = datos.puntos.at(-1)?.promedio ?? null
      } catch {
        // Sensor sin lecturas o fallo puntual: la tarjeta lo muestra vacío
      }

      return {
        id: sensor.id,
        etiqueta: meta?.etiqueta ?? 'Sensor',
        unidad: meta?.unidad ?? '',
        color: meta?.color ?? 'var(--color-text-muted)',
        ultimo,
        serie,
        umbral: regla?.umbral ?? null,
        condicion: regla?.condicion ?? null,
        disparada: reglas.some((r) => r.estado === 'disparada'),
      }
    }),
  )

  return {
    ...base,
    sensores: filas,
    alertasDisparadas: alertas.filter((a) => a.activa && a.estado === 'disparada').length,
  }
}
