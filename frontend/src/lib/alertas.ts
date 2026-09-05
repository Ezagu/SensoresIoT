import type { AlertaConNotificar, CondicionAlerta } from './tipos'

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

/* Regla a resaltar: la disparada si hay alguna, si no la primera activa. Ya no
   decide qué se dibuja en el gráfico (se dibujan todas), sólo el estado que
   pinta el valor en rojo. Mismo criterio en panel y detalle. */
export function reglaDestacada(alertas: AlertaConNotificar[], sensorId: string) {
  const reglas = reglasPorSensor(alertas).get(sensorId) ?? []
  return reglas.find((r) => r.estado === 'disparada') ?? reglas[0]
}

export type UmbralGrafico = {
  umbral: number
  condicion: CondicionAlerta
  disparada: boolean
}

/* Una línea por regla activa del sensor. Deduplicado por condición+umbral: dos
   reglas con el mismo corte (nombres o destinatarios distintos) son una sola
   línea en pantalla, y superponerlas sólo engrosaría el trazo y pisaría la
   etiqueta contra sí misma. Si alguna de esas gemelas está disparada, la línea
   lo está. */
export function umbralesDeSensor(
  alertas: AlertaConNotificar[],
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
