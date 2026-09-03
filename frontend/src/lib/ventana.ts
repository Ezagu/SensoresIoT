import { useState } from 'react'

export type RangoGrafico = 'tiempo-real' | '24h' | '7d' | '30d' | '6m' | '1a'

/* Orden y etiquetas del selector de rango del detalle, en un solo lugar. */
export const RANGOS: { valor: RangoGrafico; etiqueta: string }[] = [
  { valor: 'tiempo-real', etiqueta: 'En tiempo real' },
  { valor: '24h', etiqueta: '24h' },
  { valor: '7d', etiqueta: '7d' },
  { valor: '30d', etiqueta: '30d' },
  { valor: '6m', etiqueta: '6m' },
  { valor: '1a', etiqueta: '1a' },
]

export const HORAS_POR_RANGO: Record<RangoGrafico, number> = { 'tiempo-real': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '6m': 24 * 30 * 6, '1a': 24 * 30 * 12 }

export function duracionMsDeRango(rango: RangoGrafico): number {
  return HORAS_POR_RANGO[rango] * 3600_000
}

/* Preset o rango de fechas explícito, con la misma resolución para ambos
   casos. Sólo "En tiempo real" pollea (el resto se refresca a mano). */
export type Ventana =
  | { tipo: 'preset'; rango: RangoGrafico }
  | { tipo: 'fechas'; desde: Date; hasta: Date }

export function resolverVentana(v: Ventana): { desde: Date; hasta: Date } {
  if (v.tipo === 'fechas') return { desde: v.desde, hasta: v.hasta }
  const hasta = new Date()
  const desde = new Date(hasta.getTime() - HORAS_POR_RANGO[v.rango] * 3600_000)
  return { desde, hasta }
}

export function esTiempoReal(v: Ventana) {
  return v.tipo === 'preset' && v.rango === 'tiempo-real'
}

/* Cadencia del poll: el intervalo real del equipo, no una constante por rango
   — `intervaloSeg` llega resuelto desde `DatosGrafico.intervalo_seg`. */
export function pollDeVentana(v: Ventana, intervaloSeg: number | undefined): number | undefined {
  return esTiempoReal(v) && intervaloSeg ? intervaloSeg * 1000 : undefined
}

/* Bordes del gráfico en ms: el ancho lo da el preset (contra el tic
   compartido) o las fechas elegidas a mano / por zoom. */
export function bordesDeVentana(ventana: Ventana, tic: number): { desdeMs: number; hastaMs: number } {
  if (ventana.tipo === 'fechas') {
    return { desdeMs: ventana.desde.getTime(), hastaMs: ventana.hasta.getTime() }
  }
  return { desdeMs: tic - duracionMsDeRango(ventana.rango), hastaMs: tic }
}

/* Estado de ventana con zoom. La previa se guarda sólo en el primer zoom, así
   "restablecer" siempre vuelve al punto de partida y no a un paso intermedio. */
export function useVentanaConZoom(inicial: Ventana) {
  const [ventana, setVentana] = useState<Ventana>(inicial)
  const [previa, setPrevia] = useState<Ventana | null>(null)

  function elegir(v: Ventana) {
    setPrevia(null)
    setVentana(v)
  }

  function zoomear(desdeMs: number, hastaMs: number) {
    setPrevia((p) => p ?? ventana)
    setVentana({ tipo: 'fechas', desde: new Date(desdeMs), hasta: new Date(hastaMs) })
  }

  function restablecer() {
    if (previa) setVentana(previa)
    setPrevia(null)
  }

  return { ventana, elegir, zoomear, restablecer, hayZoom: previa !== null }
}
