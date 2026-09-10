import { useCallback, useState } from 'react'
import { listarAlertas, listarSensores, listarTiposSensor, obtenerDispositivo } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'
import { etiquetarSensores } from '@/utils/sensores'
import { intervaloEfectivo } from '@/utils/dispositivos'
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

/* Pollea porque `last_seen_at` cambia solo. Devuelve además el intervalo de
   muestreo del equipo, que es la cadencia del resto de la pantalla. */
export function useDispositivo(dispositivoId: string) {
  const cargar = useCallback(
    (signal: AbortSignal) => obtenerDispositivo(dispositivoId, signal),
    [dispositivoId],
  )
  const [cadenciaSeg, setCadenciaSeg] = useState(CADENCIA_INICIAL_SEG)
  const estado = useCarga(cargar, { intervaloMs: cadenciaSeg * 1000 })

  // Derivado en el render y no en un efecto: el intervalo real recién se conoce
  // con la primera respuesta, y un efecto agregaría un commit por lote.
  const intervaloSeg = estado.datos
    ? intervaloEfectivo(estado.datos, estado.datos.limites.intervalo_minimo_seg)
    : null
  if (intervaloSeg !== null && intervaloSeg !== cadenciaSeg) setCadenciaSeg(intervaloSeg)

  return { ...estado, intervaloSeg: intervaloSeg ?? undefined }
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
export function useAlertasDispositivo(dispositivoId: string, intervaloSeg: number | undefined) {
  const cargar = useCallback(
    (signal: AbortSignal) => listarAlertas(dispositivoId, signal),
    [dispositivoId],
  )
  const { datos, refrescar } = useCarga(cargar, {
    intervaloMs: (intervaloSeg ?? CADENCIA_INICIAL_SEG) * 1000,
  })
  return { alertas: datos ?? SIN_ALERTAS, refrescar }
}
