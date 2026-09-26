import { useCallback } from 'react'
import { useCarga } from '@/hooks/usarCarga'
import { listarAlertas, listarEventosDispositivo, obtenerGrafico } from '@/services/consultas'
import {
  esAvisoDeEquipo,
  type Alerta,
  type AvisoDeEquipo,
  type AvisoDeRegla,
  type DatosGrafico,
} from '@/tipos'

export const VENTANA_INCIDENTE_MS = 2 * 3600_000

export type DetalleAlerta = {
  regla: Alerta
  grafico: DatosGrafico | null
  /* La transición que abrió el incidente, con a cuántos se avisó. */
  aviso: AvisoDeRegla | null
}

export type DetalleSilencio = { aviso: AvisoDeEquipo | null }

/* Con 20 eventos alcanza: la transición que abrió un incidente vivo es de las
   últimas del equipo, y si quedó más atrás el bloque se arma igual sin la línea
   del aviso. */
const EVENTOS_RECIENTES = 20

async function detalleAlerta(id: string, signal: AbortSignal): Promise<DetalleAlerta | null> {
  const [reglas, { eventos }] = await Promise.all([
    listarAlertas(id, signal),
    listarEventosDispositivo(id, { limite: EVENTOS_RECIENTES }, signal),
  ])
  const regla = reglas.find((r) => r.activa && r.estado === 'disparada')
  if (!regla) return null

  const ahora = Date.now()
  const grafico = await obtenerGrafico(regla.sensor_id, new Date(ahora - VENTANA_INCIDENTE_MS), new Date(ahora), signal).catch(
    () => null,
  )
  const aviso =
    eventos.find((e): e is AvisoDeRegla => !esAvisoDeEquipo(e) && e.tipo === 'disparada' && e.alerta_id === regla.id) ??
    null
  return { regla, grafico, aviso }
}

async function detalleSilencio(id: string, signal: AbortSignal): Promise<DetalleSilencio> {
  const { eventos } = await listarEventosDispositivo(id, { limite: EVENTOS_RECIENTES }, signal)
  return { aviso: eventos.find((e): e is AvisoDeEquipo => e.tipo === 'sin_reportar') ?? null }
}

/* Lo que el panel no trae y los bloques de arriba necesitan: umbral, desde
   cuándo, la curva de las últimas 2 h y a quién se avisó. Un equipo que falla
   no tumba los demás: su bloque se arma con lo que ya se sabe. */
export function useIncidentes(alertas: string[], silencios: string[], intervaloMs?: number) {
  const claveAlertas = alertas.join(',')
  const claveSilencios = silencios.join(',')

  const cargar = useCallback(
    async (signal: AbortSignal) => {
      const ids = (clave: string) => (clave ? clave.split(',') : [])
      const [a, s] = await Promise.all([
        Promise.allSettled(ids(claveAlertas).map((id) => detalleAlerta(id, signal))),
        Promise.allSettled(ids(claveSilencios).map((id) => detalleSilencio(id, signal))),
      ])
      const porAlerta = new Map<string, DetalleAlerta>()
      ids(claveAlertas).forEach((id, i) => {
        const r = a[i]
        if (r.status === 'fulfilled' && r.value) porAlerta.set(id, r.value)
      })
      const porSilencio = new Map<string, DetalleSilencio>()
      ids(claveSilencios).forEach((id, i) => {
        const r = s[i]
        if (r.status === 'fulfilled') porSilencio.set(id, r.value)
      })
      return { porAlerta, porSilencio }
    },
    [claveAlertas, claveSilencios],
  )

  return useCarga(cargar, { intervaloMs }).datos
}
