import type { DatosGrafico } from './tipos'

/* Espejo de medicion_repo.buscar_puntos: el bucket es rango/200 con piso de 30s */
const OBJETIVO_PUNTOS = 200
const BUCKET_MINIMO_MS = 30_000

/* El backend agrupa con time_bucket y devuelve sólo los buckets que tienen
   filas: un equipo que dejó de reportar llega como buckets ausentes, no como
   null. Acá se rearma la grilla completa del rango pedido para que el hueco
   exista en la serie — Tira corta el trazo en null y nunca interpola, y ese
   corte es hoy la única señal visible de que un equipo se calló. */
export function serieDeGrafico(datos: DatosGrafico, hasta: Date): (number | null)[] {
  const desde = new Date(datos.desde_efectivo).getTime()
  const fin = hasta.getTime()
  if (!(fin > desde)) return []

  const paso = Math.max((fin - desde) / OBJETIVO_PUNTOS, BUCKET_MINIMO_MS)
  // time_bucket alinea contra la época, no contra el `desde` pedido
  const origen = Math.floor(desde / paso) * paso
  const slots = Math.ceil((fin - origen) / paso)

  const serie: (number | null)[] = new Array(slots).fill(null)
  for (const punto of datos.puntos) {
    const i = Math.round((new Date(punto.bucket).getTime() - origen) / paso)
    if (i >= 0 && i < slots) serie[i] = punto.promedio
  }
  return serie
}
