import { useCallback, useEffect, useState } from 'react'
import { useSesion } from '@/lib/auth'
import { obtenerPanel } from '@/lib/consultas'
import { etiquetarSensores } from '@/lib/sensores'
import { useCarga } from '@/lib/usarCarga'
import type { DispositivoConRol, DispositivoResumen, TipoSensor } from '@/lib/tipos'

export type SensorPanel = {
  id: string
  etiqueta: string
  unidad: string
  color: string
  ultimo: number | null
  /* `time` de esa lectura: cada fila resuelve por su cuenta si está
     desactualizada, sin que el last_seen_at del dispositivo tape a un sensor
     que se rompió mientras el resto sigue reportando. */
  ultimoAt: string | null
  disparada: boolean
}

export type DispositivoPanel = {
  dispositivo: DispositivoConRol
  sensores: SensorPanel[]
  alertasDisparadas: number
  /* Resuelto en el backend con el plan del DUEÑO: exacto también para un
     dispositivo compartido. */
  intervaloEfectivoSeg: number
}

/* El panel arma su propio catálogo de tipos de sensor a partir de lo que ya
   vino en la respuesta, sin pedir `/tipos-sensor/` aparte. */
function catalogoDeTipos(sensores: DispositivoResumen['sensores']): TipoSensor[] {
  const vistos = new Map<number, TipoSensor>()
  for (const s of sensores) {
    if (!vistos.has(s.tipo_sensor_id)) {
      vistos.set(s.tipo_sensor_id, { id: s.tipo_sensor_id, nombre: s.tipo_nombre, unidad: s.unidad })
    }
  }
  return [...vistos.values()]
}

function panelADispositivo(d: DispositivoResumen): DispositivoPanel {
  const etiquetas = etiquetarSensores(
    d.sensores.map((s) => ({ id: s.id, tipo_sensor_id: s.tipo_sensor_id })),
    catalogoDeTipos(d.sensores),
  )

  return {
    dispositivo: {
      id: d.id,
      nombre: d.nombre,
      ubicacion: d.ubicacion,
      descripcion: d.descripcion,
      activo: d.activo,
      last_seen_at: d.last_seen_at,
      first_connected_at: d.first_connected_at,
      intervalo_configurado_seg: d.intervalo_configurado_seg,
      rol: d.rol,
    },
    alertasDisparadas: d.alertas_disparadas,
    intervaloEfectivoSeg: d.intervalo_efectivo_seg,
    sensores: d.sensores.map((s): SensorPanel => {
      const meta = etiquetas.get(s.id)
      return {
        id: s.id,
        etiqueta: meta?.etiqueta ?? 'Sensor',
        unidad: meta?.unidad ?? s.unidad,
        color: meta?.color ?? 'var(--color-text-muted)',
        ultimo: s.ultimo_valor,
        ultimoAt: s.ultimo_at,
        disparada: s.disparada,
      }
    }),
  }
}

/* La cadencia del poll se aprende del propio resultado: arranca sin pollear
   y se activa al intervalo mínimo de la cartera apenas se conoce. */
export function useDispositivos() {
  const { sesion } = useSesion()
  const usuarioId = sesion?.usuario_id
  const [intervaloMs, setIntervaloMs] = useState<number | undefined>(undefined)

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DispositivoPanel[]> => {
      if (!usuarioId) return []
      const panel = await obtenerPanel(usuarioId, signal)
      return panel.dispositivos.map(panelADispositivo)
    },
    [usuarioId],
  )

  const estado = useCarga(cargar, { intervaloMs })

  useEffect(() => {
    if (!estado.datos || estado.datos.length === 0) return
    const menorSeg = Math.min(...estado.datos.map((d) => d.intervaloEfectivoSeg))
    const nuevo = menorSeg * 1000
    setIntervaloMs((actual) => (actual === nuevo ? actual : nuevo))
  }, [estado.datos])

  return estado
}
