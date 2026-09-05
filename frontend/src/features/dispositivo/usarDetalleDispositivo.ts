import { useCallback, useEffect, useState } from 'react'
import { listarAlertas, listarTiposSensor, obtenerDispositivo, obtenerGrafico } from '@/lib/consultas'
import { useCarga } from '@/lib/usarCarga'
import { pollDeVentana, resolverVentana, type Ventana } from '@/lib/ventana'
import type { AlertaConNotificar, DatosGrafico, DispositivoDetalle } from '@/lib/tipos'
import { cargarSensoresConMeta, type SensorConMeta } from './cargarSensores'

export type DatosDetalle = {
  dispositivo: DispositivoDetalle
  sensores: SensorConMeta[]
}

/* Parte estática del detalle: dispositivo y sensores. No pollea — nada de esto
   cambia seguido. Se refresca sólo al montar y con `refrescar()` (cambio de
   intervalo). */
export function useDetalleDispositivo(dispositivoId: string) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DatosDetalle> => {
      const [dispositivo, tipos] = await Promise.all([
        obtenerDispositivo(dispositivoId, signal),
        listarTiposSensor(signal),
      ])
      return { dispositivo, sensores: await cargarSensoresConMeta(dispositivoId, tipos, signal) }
    },
    [dispositivoId],
  )

  return useCarga(cargar)
}

/* Cadencia del poll de estado antes de conocer el intervalo real del equipo. */
const CADENCIA_ESTADO_SEG = 60

/* Cuándo reportó el equipo por última vez. Es conectividad, no datos del rango:
   con una ventana histórica elegida los gráficos dejan de pollear (`pollDeVentana`)
   y `last_seen_at` se quedaría clavado en el valor que trajo el detalle al
   montar, envejeciendo en pantalla mientras el equipo sigue reportando. Un
   request por equipo, no uno por sensor. */
export function useUltimoReporte(dispositivoId: string, intervaloSeg: number | undefined) {
  const cargar = useCallback(
    (signal: AbortSignal) => obtenerDispositivo(dispositivoId, signal).then((d) => d.last_seen_at),
    [dispositivoId],
  )
  const { datos } = useCarga(cargar, { intervaloMs: (intervaloSeg ?? CADENCIA_ESTADO_SEG) * 1000 })
  return datos ?? null
}

/* Reglas del dispositivo, con su estado. Va aparte del lote estático porque el
   backend lo cambia solo mientras la pantalla está abierta: sin poll, una regla
   que se dispara recién aparece si el usuario recarga.

   Y con la cadencia de estado, no la de los gráficos: una alerta se dispara
   ahora, no dentro de la ventana que estés mirando, y con un rango histórico
   elegido los gráficos dejan de pollear (`pollDeVentana`). Mirar 30 días no
   puede dejar de avisarte.

   Las alertas son del dispositivo aunque se muestren por sensor, así que el
   detalle de sensor consume este mismo hook y filtra. */
export function useAlertasDispositivo(dispositivoId: string, intervaloSeg: number | undefined) {
  const cargar = useCallback(
    (signal: AbortSignal) => listarAlertas(dispositivoId, signal),
    [dispositivoId],
  )
  const { datos, refrescar } = useCarga(cargar, {
    intervaloMs: (intervaloSeg ?? CADENCIA_ESTADO_SEG) * 1000,
  })
  return { alertas: datos ?? EMPTY, refrescar }
}

/* Referencia estable: `datos ?? []` crearía un array nuevo por render y todo lo
   que dependa de esa identidad se recalcularía en cada tic. */
const EMPTY: AlertaConNotificar[] = []

/* El lote viaja con la ventana que lo pidió: sin eso no hay forma de saber si
   lo que está en pantalla corresponde al rango que el usuario tiene elegido. */
type LoteGraficos = { porSensor: Map<string, DatosGrafico | null>; ventana: Ventana }

/* Pollea los gráficos, y sólo en tiempo real: un rango cerrado no cambia. El
   intervalo de poll se aprende del propio resultado (`intervalo_seg` del primer
   gráfico que vuelve, todos los sensores de un equipo lo comparten). */
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
