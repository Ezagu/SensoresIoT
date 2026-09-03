import { useCallback, useEffect, useState } from 'react'
import { listarTiposSensor, obtenerDispositivo, obtenerGrafico, obtenerHistorial } from '@/lib/consultas'
import { useCarga } from '@/lib/usarCarga'
import { pollDeVentana, resolverVentana, type Ventana } from '@/lib/ventana'
import type { AlertaConNotificar, DatosGrafico, Dispositivo, Medicion } from '@/lib/tipos'
import { cargarSensoresConMeta, type SensorConMeta } from './cargarSensores'

/* `estadoHttp` (lib/api.ts) sólo reconoce AxiosError: un sensorId ajeno al
   dispositivo nunca golpea la red, así que se modela como un error propio en
   vez de fabricar un AxiosError falso. */
export class SensorNoEncontradoError extends Error {
  constructor() {
    super('Sensor no encontrado')
  }
}

export type DetalleSensorEstatico = {
  dispositivo: Dispositivo
  sensor: SensorConMeta
  alertas: AlertaConNotificar[]
}

/* El dispositivo_id sale de la URL (ruta anidada): un sensorId que no está
   entre los del dispositivo se trata como 404, igual que un dispositivo
   inexistente. No pollea: se refresca sólo al montar y con `refrescar()`. */
export function useDetalleSensorEstatico(dispositivoId: string, sensorId: string) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DetalleSensorEstatico> => {
      const [dispositivo, tipos] = await Promise.all([
        obtenerDispositivo(dispositivoId, signal),
        listarTiposSensor(signal),
      ])

      const { sensores, alertas } = await cargarSensoresConMeta(dispositivoId, tipos, signal)
      const sensor = sensores.find((s) => s.id === sensorId)
      if (!sensor) throw new SensorNoEncontradoError()

      return {
        dispositivo,
        sensor,
        alertas: alertas.filter((a) => a.sensor_id === sensorId),
      }
    },
    [dispositivoId, sensorId],
  )

  return useCarga(cargar)
}

export type DatosSensor = {
  datos: DatosGrafico | null
  /* Última lectura cruda, independiente de la ventana elegida: no puede
     salir del último bucket del gráfico porque ese es un promedio. */
  ultima: Medicion | null
}

/* Único hook que pollea acá. La cadencia se aprende de `intervalo_seg` del
   propio gráfico, mismo criterio que useGraficosDeSensores. */
export function useDatosSensor(sensorId: string, ventana: Ventana) {
  const [intervaloSeg, setIntervaloSeg] = useState<number | undefined>(undefined)

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DatosSensor> => {
      const { desde, hasta } = resolverVentana(ventana)
      const [datos, ultima] = await Promise.all([
        obtenerGrafico(sensorId, desde, hasta, signal).catch(() => null),
        // limite=1 es la lectura cruda más reciente, sin ventana ni promediar
        obtenerHistorial(sensorId, { limite: 1 }, signal)
          .then((r) => r.mediciones[0] ?? null)
          .catch(() => null),
      ])
      return { datos, ultima }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sensorId, ventana],
  )

  const estado = useCarga(cargar, { intervaloMs: pollDeVentana(ventana, intervaloSeg) })

  useEffect(() => {
    const actual = estado.datos?.datos?.intervalo_seg
    if (actual !== undefined && actual !== intervaloSeg) setIntervaloSeg(actual)
  }, [estado.datos, intervaloSeg])

  return { ...estado, intervaloSeg }
}
