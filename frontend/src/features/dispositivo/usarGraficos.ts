import { useCallback } from 'react'
import { obtenerGrafico, obtenerHistorial } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'
import { pollDeVentana, resolverVentana, type Ventana } from '@/utils/ventana'
import type { DatosGrafico, Medicion } from '@/tipos'
import type { SensorConMeta } from './usarDispositivo'

/* Alcanza con comparar identidad: `ventana` sólo cambia de objeto cuando alguien
   la elige, un poll en tiempo real reusa el mismo. */
function estaDesactualizado(pedida: Ventana, actual: Ventana | undefined) {
  return actual !== undefined && actual !== pedida
}

/* Un gráfico por sensor del equipo. Sólo pollea en tiempo real: un rango
   cerrado no cambia. */
export function useGraficosDeSensores(
  sensores: SensorConMeta[],
  ventana: Ventana,
  cadenciaSeg: number | undefined,
) {
  const idsKey = sensores.map((s) => s.id).join(',')

  const cargar = useCallback(
    async (signal: AbortSignal) => {
      const ids = idsKey ? idsKey.split(',') : []
      const { desde, hasta } = resolverVentana(ventana)
      const entradas = await Promise.all(
        ids.map(async (id): Promise<[string, DatosGrafico | null]> => {
          try {
            return [id, await obtenerGrafico(id, desde, hasta, signal)]
          } catch {
            // Sensor sin lecturas o fallo puntual: se muestra vacío, no rompe el resto
            return [id, null]
          }
        }),
      )
      return { porSensor: new Map(entradas), ventana }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, ventana],
  )

  const { datos, ...estado } = useCarga(cargar, {
    intervaloMs: pollDeVentana(ventana, cadenciaSeg),
  })

  return {
    ...estado,
    porSensor: datos?.porSensor ?? new Map<string, DatosGrafico | null>(),
    /* Una hora de lecturas sobre un eje de 30 días se ve igual que un equipo
       muerto un mes: hay que marcarlo hasta que llegue el lote nuevo. */
    desactualizado: estaDesactualizado(ventana, datos?.ventana),
  }
}

export type DatosSensor = {
  datos: DatosGrafico | null
  /* Última lectura cruda, independiente de la ventana: no puede salir del
     último bucket del gráfico porque ese es un promedio. */
  ultima: Medicion | null
  ventana: Ventana
}

export function useDatosSensor(
  sensorId: string,
  ventana: Ventana,
  cadenciaSeg: number | undefined,
) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DatosSensor> => {
      const { desde, hasta } = resolverVentana(ventana)
      const [datos, ultima] = await Promise.all([
        obtenerGrafico(sensorId, desde, hasta, signal).catch(() => null),
        obtenerHistorial(sensorId, { limite: 1 }, signal)
          .then((r) => r.mediciones[0] ?? null)
          .catch(() => null),
      ])
      return { datos, ultima, ventana }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sensorId, ventana],
  )

  const estado = useCarga(cargar, { intervaloMs: pollDeVentana(ventana, cadenciaSeg) })
  return { ...estado, desactualizado: estaDesactualizado(ventana, estado.datos?.ventana) }
}
