import { listarSensores } from '@/lib/consultas'
import { etiquetarSensores } from '@/lib/sensores'
import type { DatosGrafico, TipoSensor } from '@/lib/tipos'

/* Sensor activo con su metadata resuelta (etiqueta/unidad/color por tipo), sin
   lecturas: es la parte estática del detalle (no pollea) y la que consumen
   BloqueAlertas / BloqueSensor antes de cruzarla con el gráfico. */
export type SensorConMeta = {
  id: string
  tipoSensorId: number
  etiqueta: string
  unidad: string
  color: string
  /* Nombre del tipo tal cual lo trae el catálogo: lo consumen los helpers que
     dependen de la magnitud medida, no de la etiqueta mostrada. */
  tipo: string
}

/* `datos` es null sin lecturas en el rango o si el request puntual falló: un
   sensor caído no tira abajo el resto del dispositivo. */
export type SensorConDatos = SensorConMeta & { datos: DatosGrafico | null }

/* Las alertas no vienen acá: su estado cambia solo mientras la pantalla está
   abierta y necesita su propio poll (ver useAlertasDispositivo). */
export async function cargarSensoresConMeta(
  dispositivoId: string,
  tipos: TipoSensor[],
  signal: AbortSignal,
): Promise<SensorConMeta[]> {
  const sensores = await listarSensores(dispositivoId, signal)
  const activos = sensores.filter((s) => s.activo)
  const etiquetas = etiquetarSensores(activos, tipos)

  return activos.map((sensor) => {
    const meta = etiquetas.get(sensor.id)
    return {
      id: sensor.id,
      tipoSensorId: sensor.tipo_sensor_id,
      etiqueta: meta?.etiqueta ?? 'Sensor',
      unidad: meta?.unidad ?? '',
      color: meta?.color ?? 'var(--color-text-muted)',
      tipo: meta?.tipo ?? 'Sensor',
    }
  })
}
