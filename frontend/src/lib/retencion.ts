import { duracionMsDeRango, type RangoGrafico } from './ventana'

/* Margen por desfase de reloj cliente/servidor, para no marcar como recortado
   un rango que sólo pisa el borde por latencia. */
const MARGEN_RELOJ_MS = 60_000

export function excedeRetencion(desde: Date, retencionDias: number | null) {
  if (retencionDias === null) return false
  const piso = Date.now() - retencionDias * 86400_000
  return desde.getTime() < piso - MARGEN_RELOJ_MS
}

/* Gate premium de las opciones preset de SelectorVentana. */
export function rangoExcedeRetencion(rango: RangoGrafico, retencionDias: number | null) {
  return excedeRetencion(new Date(Date.now() - duracionMsDeRango(rango)), retencionDias)
}

/* `retencion_dias` null es hoy la única marca de "el dueño es premium" que
   viaja en la respuesta del gráfico; no hay flag propio en el catálogo.
   El zoom queda libre a propósito: sólo achica una ventana ya vista. */
export function permiteRangoPersonalizado(retencionDias: number | null) {
  return retencionDias === null
}
