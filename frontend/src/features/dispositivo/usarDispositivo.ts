import { useCallback, useState } from 'react'
import { listarAlertas, listarSensores, listarTiposSensor, obtenerDispositivo, obtenerEstadoDispositivo } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'
import { etiquetarSensores } from '@/utils/sensores'
import type { Alerta, DatosGrafico } from '@/tipos'

export type SensorConMeta = {
  id: string
  tipoSensorId: number
  etiqueta: string
  unidad: string
  color: string
  /* Nombre del tipo tal cual lo trae el catálogo, para los helpers que dependen
     de la magnitud medida y no de la etiqueta mostrada. */
  tipo: string
}

/* `datos` es null sin lecturas en el rango o si el request puntual falló. */
export type SensorConDatos = SensorConMeta & { datos: DatosGrafico | null }

/* Cadencia del poll de estado antes de conocer el intervalo real del equipo. */
const CADENCIA_INICIAL_SEG = 60
const MARGEN_SIGUIENTE_MEDICION_SEG = 3

const PISO_CADENCIA_SEG = 10
/* El equipo no reportó cuando debía: no sabemos cuándo vuelve, así que dejamos
   de preguntar seguido en vez de martillar. */
const CADENCIA_ATRASADO_SEG = 120

function calcularCadencia(siguienteMedicion: number | null | undefined): number {
  // Nunca reportó: no hay desde dónde estimar.
  if (siguienteMedicion == null) return CADENCIA_INICIAL_SEG
  if (siguienteMedicion === 0) return CADENCIA_ATRASADO_SEG

  // El piso desacopla el poll de la resolución del sensor: aunque un premium
  // muestree cada 5s, no pedimos más de una vez cada PISO_CADENCIA_SEG.
  return Math.max(siguienteMedicion + MARGEN_SIGUIENTE_MEDICION_SEG, PISO_CADENCIA_SEG)
}

/* No pollea: nada de lo que devuelve cambia solo. Lo que sí cambia
   (`last_seen_at`, alertas disparadas) vive en useEstadoDispositivo. */
export function useDispositivo(dispositivoId: string) {
  const cargar = useCallback(
    (signal: AbortSignal) => obtenerDispositivo(dispositivoId, signal),
    [dispositivoId],
  )
  return useCarga(cargar)
}

/* `cadenciaSeg` la gobierna el equipo, no un intervalo fijo: sale de cuánto
   falta para su próximo reporte, así que el poll cae justo después del dato y
   no a mitad de camino. Es la cadencia de toda la pantalla — gráficos y alertas
   la comparten, y compartirla es lo que los mantiene alineados entre sí: los
   tres timers se programan con el mismo número, vencen juntos y se reprograman
   juntos con la respuesta que ya dispararon. */
export function useEstadoDispositivo(dispositivoId: string) {
  const cargar = useCallback(
    (signal: AbortSignal) => obtenerEstadoDispositivo(dispositivoId, signal),
    [dispositivoId],
  )
  const [cadenciaSeg, setCadenciaSeg] = useState(CADENCIA_INICIAL_SEG)
  const estado = useCarga(cargar, { intervaloMs: cadenciaSeg * 1000 })

  // Derivado en el render y no en un efecto: el valor recién se conoce con la
  // primera respuesta, y un efecto agregaría un commit por lote.
  const proxima = calcularCadencia(estado.datos?.siguiente_medicion)
  if (proxima !== cadenciaSeg) setCadenciaSeg(proxima)

  return { ...estado, cadenciaSeg }
}

/* Sensores activos con su metadata por tipo. No pollea: un equipo no gana ni
   pierde sensores mientras se lo mira. */
export function useSensoresConMeta(dispositivoId: string) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<SensorConMeta[]> => {
      const [tipos, sensores] = await Promise.all([
        listarTiposSensor(signal),
        listarSensores(dispositivoId, signal),
      ])
      const porTipo = new Map(tipos.map((t) => [t.id, t]))
      const activos = sensores
        .filter((s) => s.activo)
        .map((s) => ({
          id: s.id,
          tipo_sensor_id: s.tipo_sensor_id,
          tipo_nombre: porTipo.get(s.tipo_sensor_id)?.nombre ?? 'Sensor',
          unidad: porTipo.get(s.tipo_sensor_id)?.unidad ?? '',
        }))

      const etiquetas = etiquetarSensores(activos)
      return activos.map((s) => ({ id: s.id, tipoSensorId: s.tipo_sensor_id, ...etiquetas.get(s.id)! }))
    },
    [dispositivoId],
  )

  return useCarga(cargar)
}

/* Referencia estable: `datos ?? []` crearía un array nuevo por render. */
const SIN_ALERTAS: Alerta[] = []

/* A la cadencia del equipo y no a la de los gráficos: una alerta se dispara
   ahora, no dentro de la ventana que se mira, y con un rango histórico los
   gráficos dejan de pollear. El detalle de sensor usa este mismo hook y filtra. */
export function useAlertasDispositivo(dispositivoId: string, cadenciaSeg: number | undefined) {
  const cargar = useCallback(
    (signal: AbortSignal) => listarAlertas(dispositivoId, signal),
    [dispositivoId],
  )
  const { datos, refrescar } = useCarga(cargar, {
    intervaloMs: (cadenciaSeg ?? CADENCIA_INICIAL_SEG) * 1000,
  })
  return { alertas: datos ?? SIN_ALERTAS, refrescar }
}
