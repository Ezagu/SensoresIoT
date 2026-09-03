import { listarAlertas, listarSensores } from '@/lib/consultas'
import { etiquetarSensores } from '@/lib/sensores'
import type { AlertaConNotificar, DatosGrafico, TipoSensor } from '@/lib/tipos'

/* Sensor activo con su metadata resuelta (etiqueta/unidad/color por tipo),
   sin lecturas: es la parte estática del detalle (no pollea) y la que
   consumen BloqueAlertas / BloqueSensor antes de cruzarla con el gráfico. */
export type SensorConMeta = {
  id: string
  tipoSensorId: number
  etiqueta: string
  unidad: string
  color: string
}

/* Lo que necesita el gráfico: la metadata más los datos del rango elegido.
   `datos` es null cuando el sensor no tiene lecturas en el rango, el request
   puntual falló, o el gráfico todavía no polleó: un sensor caído no puede
   tirar abajo el resto del dispositivo. */
export type SensorConDatos = SensorConMeta & { datos: DatosGrafico | null }

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
