import type { AlertaConNotificar } from './tipos'

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

/* Regla a resaltar en el gráfico: la disparada si hay alguna, si no la
   primera activa. Mismo criterio en panel y detalle. */
export function reglaDestacada(alertas: AlertaConNotificar[], sensorId: string) {
  const reglas = reglasPorSensor(alertas).get(sensorId) ?? []
  return reglas.find((r) => r.estado === 'disparada') ?? reglas[0]
}
