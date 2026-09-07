import type { DatosGrafico } from '@/tipos'
import { duracionMsDeRango, type RangoGrafico } from './ventana'

/* Margen por desfase de reloj cliente/servidor, para no marcar como recortado
   un rango que sólo pisa el borde por latencia. */
const MARGEN_RELOJ_MS = 60_000

function excedeRetencion(desde: Date, retencionDias: number | null) {
  if (retencionDias === null) return false
  const piso = Date.now() - retencionDias * 86400_000
  return desde.getTime() < piso - MARGEN_RELOJ_MS
}

/* Marca (no candado) de las opciones preset de SelectorVentana: el rango se
   puede elegir igual y AvisoVentana explica qué parte quedó afuera. */
export function rangoExcedeRetencion(rango: RangoGrafico, retencionDias: number | null) {
  return excedeRetencion(new Date(Date.now() - duracionMsDeRango(rango)), retencionDias)
}

/* `retencion_dias` null es hoy la única marca de "el dueño es premium" que
   viaja en la respuesta del gráfico; no hay flag propio en el catálogo. */
export function permiteHistorialCompleto(retencionDias: number | null) {
  return retencionDias === null
}

/* El backend compara contra su propio now(), siempre posterior al del cliente:
   pedir 7 d con 7 d de retención da recortado=true sin que falte un dato. */
export function recorteEsMaterial(desdeEfectivo: string, desdePedidoMs: number) {
  return new Date(desdeEfectivo).getTime() - desdePedidoMs > MARGEN_RELOJ_MS
}

export type LimiteDeVentana = {
  /* Borde izquierdo que tiene que dibujar el eje X. */
  desdeMs: number
  /* Dónde va la pared del plan, o null si el plan no es lo que limita. */
  corteDePlanMs: number | null
  /* Fecha del primer reporte, sólo cuando es ella la que limita. */
  primeraConexion: string | null
}

/* Qué limita el borde izquierdo, en un solo lugar: lo consumen el eje, la marca
   del corte y el aviso, y las tres tienen que contestar lo mismo. El eje arranca
   en `desde_efectivo` cuando el plan recortó, porque dibujar la ventana pedida
   dejaría ese tramo en blanco, igual que un equipo mudo. Si el equipo empezó a
   reportar después del piso del plan, el que limita es el equipo. */
export function limiteDeVentana(
  grafico: DatosGrafico | null,
  primeraConexion: string | null,
  desdePedidoMs: number,
): LimiteDeVentana {
  const primeraMs = primeraConexion ? new Date(primeraConexion).getTime() : null
  const efectivoMs = grafico ? new Date(grafico.desde_efectivo).getTime() : desdePedidoMs
  const recortado = !!grafico?.recortado && recorteEsMaterial(grafico.desde_efectivo, desdePedidoMs)
  const desdeMs = recortado ? efectivoMs : desdePedidoMs
  const mandaElEquipo = primeraMs !== null && primeraMs > desdeMs

  return {
    desdeMs,
    corteDePlanMs: recortado && !mandaElEquipo ? efectivoMs : null,
    primeraConexion: mandaElEquipo ? primeraConexion : null,
  }
}
