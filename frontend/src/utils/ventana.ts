export type RangoGrafico = '1h' | '6h' | '24h' | '3d' | '7d' | '30d'

/* Orden y etiquetas del selector de rango, en un solo lugar. */
export const RANGOS: { valor: RangoGrafico; etiqueta: string }[] = [
  { valor: '1h', etiqueta: '1 h' },
  { valor: '6h', etiqueta: '6 h' },
  { valor: '24h', etiqueta: '24 h' },
  { valor: '3d', etiqueta: '3 d' },
  { valor: '7d', etiqueta: '7 d' },
  { valor: '30d', etiqueta: '30 d' },
]

export const HORAS_POR_RANGO: Record<RangoGrafico, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '3d': 72,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

export function duracionMsDeRango(rango: RangoGrafico): number {
  return HORAS_POR_RANGO[rango] * 3600_000
}

/* Preset (siempre termina ahora) o rango fijo (lo producen "Personalizado" y
   el zoom). */
export type Ventana =
  { tipo: 'preset'; rango: RangoGrafico } | { tipo: 'fechas'; desde: Date; hasta: Date }

export const VENTANA_INICIAL: Ventana = { tipo: 'preset', rango: '24h' }

export function resolverVentana(v: Ventana): { desde: Date; hasta: Date } {
  if (v.tipo === 'fechas') return { desde: v.desde, hasta: v.hasta }
  const hasta = new Date()
  return { desde: new Date(hasta.getTime() - duracionMsDeRango(v.rango)), hasta }
}

/* Hasta 24 h el borde derecho es "ahora" y un dato nuevo cambia lo que se ve:
   se pollea. Más atrás un punto nuevo es un píxel, y el rango se refresca a
   mano. */
export function esTiempoReal(v: Ventana) {
  return v.tipo === 'preset' && HORAS_POR_RANGO[v.rango] <= 24
}

/* Cadencia del poll: la del equipo, no una constante por rango. Llega desde
   `useEstadoDispositivo`, que la deriva de cuánto falta para el próximo
   reporte, así que el pedido cae justo después del dato nuevo. */
export function pollDeVentana(v: Ventana, cadenciaSeg: number | undefined): number | undefined {
  return esTiempoReal(v) && cadenciaSeg ? cadenciaSeg * 1000 : undefined
}

/* Bordes del gráfico en ms: el ancho lo da el preset (contra el tic
   compartido) o las fechas elegidas a mano / por zoom. */
export function bordesDeVentana(
  ventana: Ventana,
  tic: number,
): { desdeMs: number; hastaMs: number } {
  if (ventana.tipo === 'fechas') {
    return { desdeMs: ventana.desde.getTime(), hastaMs: ventana.hasta.getTime() }
  }
  return { desdeMs: tic - duracionMsDeRango(ventana.rango), hastaMs: tic }
}

/* "últimas 24 h" / "del 18/9 al 25/9": cómo se nombra el período en títulos. */
export function nombreDeVentana(v: Ventana): string {
  if (v.tipo === 'preset') return `últimas ${RANGOS.find((r) => r.valor === v.rango)!.etiqueta}`
  const fmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric' })
  return `del ${fmt.format(v.desde)} al ${fmt.format(v.hasta)}`
}
