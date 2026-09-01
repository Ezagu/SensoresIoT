import type { DatosGrafico } from './tipos'

/* Espejo de medicion_repo.buscar_puntos: el bucket es rango/200 con piso de 30s */
const OBJETIVO_PUNTOS = 200
const BUCKET_MINIMO_MS = 30_000

export type PuntoGrilla = { t: number; valor: number | null }

/* El backend agrupa con time_bucket y devuelve sólo los buckets que tienen
   filas: un dispositivo que dejó de reportar llega como buckets ausentes, no como
   null. Acá se rearma la grilla completa del rango pedido para que el hueco
   exista en la serie — un hueco interpolado sería mentir sobre un corte de
   reporte, y hoy es la única señal visible de que un dispositivo se calló.
   Un sólo cálculo para la tira del panel y el gráfico grande: no puede
   divergir entre los dos.
   `hasta` es epoch en ms y no un Date: viene de un tic compartido (useAhora) y
   un objeto nuevo por render invalidaría cualquier memo aguas abajo. */
export function grillaDeGrafico(datos: DatosGrafico, hasta: number): PuntoGrilla[] {
  const desde = new Date(datos.desde_efectivo).getTime()
  const fin = hasta
  if (!(fin > desde)) return []

  const paso = Math.max((fin - desde) / OBJETIVO_PUNTOS, BUCKET_MINIMO_MS)
  // time_bucket alinea contra la época, no contra el `desde` pedido
  const origen = Math.floor(desde / paso) * paso
  const slots = Math.ceil((fin - origen) / paso)

  const grilla: PuntoGrilla[] = Array.from({ length: slots }, (_, i) => ({
    t: origen + i * paso,
    valor: null,
  }))
  for (const punto of datos.puntos) {
    const i = Math.round((new Date(punto.bucket).getTime() - origen) / paso)
    if (i >= 0 && i < slots) grilla[i].valor = punto.promedio
  }
  return grilla
}

export function serieDeGrafico(datos: DatosGrafico, hasta: number): (number | null)[] {
  return grillaDeGrafico(datos, hasta).map((p) => p.valor)
}
