import type { Estado } from '@/components/ui/MarcaEstado'
import type { Alerta, CondicionAlerta } from '@/tipos'
import type { EstadoDispositivo } from './tiempo'

/* Para el detalle (BloqueAlertas): todas las reglas del sensor, activas o no
   — el usuario administra ambas. */
export function agruparAlertasPorSensor(alertas: Alerta[]) {
  const mapa = new Map<string, Alerta[]>()
  for (const alerta of alertas) {
    const acumuladas = mapa.get(alerta.sensor_id) ?? []
    acumuladas.push(alerta)
    mapa.set(alerta.sensor_id, acumuladas)
  }
  return mapa
}

/* Sólo reglas activas: el umbral del gráfico del detalle y el flag de
   disparada del panel. */
function reglasPorSensor(alertas: Alerta[]) {
  const mapa = new Map<string, Alerta[]>()
  for (const alerta of alertas) {
    if (!alerta.activa) continue
    const acumuladas = mapa.get(alerta.sensor_id) ?? []
    acumuladas.push(alerta)
    mapa.set(alerta.sensor_id, acumuladas)
  }
  return mapa
}

/* La disparada si hay alguna, si no la primera activa: decide el estado que
   pinta el valor en rojo. Mismo criterio en panel y detalle. */
export function reglaDestacada(alertas: Alerta[], sensorId: string) {
  const reglas = reglasPorSensor(alertas).get(sensorId) ?? []
  return reglas.find((r) => r.estado === 'disparada') ?? reglas[0]
}

export type UmbralGrafico = {
  umbral: number
  condicion: CondicionAlerta
  disparada: boolean
}

/* Una línea por regla activa, deduplicada por condición+umbral: dos reglas con
   el mismo corte son una sola línea. Si alguna gemela está disparada, lo está. */
export function umbralesDeSensor(
  alertas: Alerta[],
  sensorId: string,
): UmbralGrafico[] {
  const porCorte = new Map<string, UmbralGrafico>()
  for (const alerta of reglasPorSensor(alertas).get(sensorId) ?? []) {
    const clave = `${alerta.condicion}:${alerta.umbral}`
    const previa = porCorte.get(clave)
    const disparada = alerta.estado === 'disparada' || (previa?.disparada ?? false)
    porCorte.set(clave, { umbral: alerta.umbral, condicion: alerta.condicion, disparada })
  }
  return [...porCorte.values()].sort((a, b) => a.umbral - b.umbral)
}

/* Qué se dice de una regla, contra la conectividad ya resuelta del equipo
   (`estadoDispositivo`), nunca derivada acá. Con el equipo mudo una `normal`
   es "Sin evaluar": sin lecturas nadie comprobó nada. Una `disparada` no se
   degrada: es el último estado conocido. Pausada no tiene estado que informar. */
export function estadoDeRegla(
  alerta: Alerta,
  conectividad: EstadoDispositivo,
): { glifo: Estado; texto: string } {
  if (!alerta.activa) return { glifo: 'inactivo', texto: 'Pausada' }
  if (alerta.estado === 'disparada') return { glifo: 'critico', texto: 'Disparada' }
  if (conectividad === 'nunca') return { glifo: 'sin-datos', texto: 'Sin evaluar' }
  if (conectividad === 'sin-reportar') return { glifo: 'sin-reportar', texto: 'Sin evaluar' }
  return { glifo: 'normal', texto: 'Normal' }
}
