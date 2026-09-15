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

/* "En tiempo real" es el único que pollea; su ventana es de 6 h porque con una
   publicación cada 15 o 30 min una hora dibuja cuatro puntos y no una serie. */
export const HORAS_POR_RANGO: Record<RangoGrafico, number> = { 'tiempo-real': 6, '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '6m': 24 * 30 * 6, '1a': 24 * 30 * 12 }

export function duracionMsDeRango(rango: RangoGrafico): number {
  return HORAS_POR_RANGO[rango] * 3600_000
}

/* Preset, "Máx" (desde el primer reporte) o rango fijo (sólo lo produce el
   zoom). Sólo "En tiempo real" pollea; el resto se refresca a mano. */
export type Ventana =
  | { tipo: 'preset'; rango: RangoGrafico }
  | { tipo: 'maximo'; desde: Date }
  | { tipo: 'fechas'; desde: Date; hasta: Date }

export function resolverVentana(v: Ventana): { desde: Date; hasta: Date } {
  if (v.tipo === 'fechas') return { desde: v.desde, hasta: v.hasta }
  const hasta = new Date()
  if (v.tipo === 'maximo') return { desde: v.desde, hasta }
  const desde = new Date(hasta.getTime() - HORAS_POR_RANGO[v.rango] * 3600_000)
  return { desde, hasta }
}

export function esTiempoReal(v: Ventana) {
  return v.tipo === 'preset' && v.rango === 'tiempo-real'
}

/* Cadencia del poll: la del equipo, no una constante por rango. Llega desde
   `useEstadoDispositivo`, que la deriva de cuánto falta para el próximo
   reporte, así que el pedido cae justo después del dato nuevo. */
export function pollDeVentana(v: Ventana, cadenciaSeg: number | undefined): number | undefined {
  return esTiempoReal(v) && cadenciaSeg ? cadenciaSeg * 1000 : undefined
}

/* Bordes del gráfico en ms: el ancho lo da el preset (contra el tic
   compartido) o las fechas elegidas a mano / por zoom. */
export function bordesDeVentana(ventana: Ventana, tic: number): { desdeMs: number; hastaMs: number } {
  if (ventana.tipo === 'fechas') {
    return { desdeMs: ventana.desde.getTime(), hastaMs: ventana.hasta.getTime() }
  }
  if (ventana.tipo === 'maximo') {
    return { desdeMs: ventana.desde.getTime(), hastaMs: tic }
  }
  return { desdeMs: tic - duracionMsDeRango(ventana.rango), hastaMs: tic }
}
