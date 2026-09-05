import { useCallback, useEffect, useState } from 'react'
import { listarTiposSensor, obtenerDispositivo, obtenerGrafico } from '@/lib/consultas'
import { useCarga } from '@/lib/usarCarga'
import { pollDeVentana, resolverVentana, type Ventana } from '@/lib/ventana'
import type { AlertaConNotificar, DatosGrafico, DispositivoDetalle } from '@/lib/tipos'
import { cargarSensoresConMeta, type SensorConMeta } from './cargarSensores'

export type DatosDetalle = {
  dispositivo: DispositivoDetalle
  sensores: SensorConMeta[]
  alertas: AlertaConNotificar[]
}

/* Parte estática del detalle: dispositivo, sensores, alertas. No pollea —
   nada de esto cambia seguido. Se refresca sólo al montar y con
   `refrescar()` (alta/edición/borrado de alertas, cambio de intervalo). */
export function useDetalleDispositivo(dispositivoId: string) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DatosDetalle> => {
      const [dispositivo, tipos] = await Promise.all([
        obtenerDispositivo(dispositivoId, signal),
        listarTiposSensor(signal),
      ])
      const { sensores, alertas } = await cargarSensoresConMeta(dispositivoId, tipos, signal)
      return { dispositivo, sensores, alertas }
    },
    [dispositivoId],
  )

  return useCarga(cargar)
}

/* El lote viaja con la ventana que lo pidió: sin eso no hay forma de saber si
   lo que está en pantalla corresponde al rango que el usuario tiene elegido. */
type LoteGraficos = { porSensor: Map<string, DatosGrafico | null>; ventana: Ventana }

/* Único hook que pollea en el detalle, y sólo pide /grafico por sensor. El
   intervalo de poll se aprende del propio resultado (`intervalo_seg` del
   primer gráfico que vuelve, todos los sensores de un equipo lo comparten). */
export function useGraficosDeSensores(sensores: SensorConMeta[], ventana: Ventana) {
  const idsKey = sensores.map((s) => s.id).join(',')
  const [intervaloSeg, setIntervaloSeg] = useState<number | undefined>(undefined)

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<LoteGraficos> => {
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

  const { datos, cargando, refrescando, error, errorCrudo, refrescar } = useCarga(cargar, {
    intervaloMs: pollDeVentana(ventana, intervaloSeg),
  })

  useEffect(() => {
    if (!datos) return
    const primero = [...datos.porSensor.values()].find((d) => d !== null)
    if (primero && primero.intervalo_seg !== intervaloSeg) setIntervaloSeg(primero.intervalo_seg)
  }, [datos, intervaloSeg])

  return {
    porSensor: datos?.porSensor ?? new Map<string, DatosGrafico | null>(),
    /* Lo dibujado es de otra ventana que la elegida. `useCarga` conserva los
       datos viejos a propósito, pero una hora de lecturas sobre un eje de 30
       días se ve exactamente igual que un equipo muerto un mes: hay que
       marcarlo hasta que llegue el lote nuevo. Alcanza con comparar identidad
       porque `ventana` sólo cambia de objeto cuando alguien la cambia — un
       poll en tiempo real reusa el mismo. */
    desactualizado: datos !== null && datos.ventana !== ventana,
    intervaloSeg,
    cargando,
    refrescando,
    error,
    errorCrudo,
    refrescar,
  }
}
