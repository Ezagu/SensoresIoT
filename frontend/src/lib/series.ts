import type { DatosGrafico } from './tipos'

export type PuntoGrilla = { t: number; valor: number | null }

/* El paso esperado lo dice el backend: el bucket si agregó, el intervalo de
   muestreo del equipo si devolvió las lecturas crudas (bucket_seg null). Una
   separación mayor a FACTOR_HUECO veces ese paso es un corte de reporte, no
   jitter del muestreo, y se intercala como null para cortar el trazo — sigue
   siendo la única señal visible de que un dispositivo se calló. */
const FACTOR_HUECO = 1.8

export function serieDeGrafico(datos: DatosGrafico): PuntoGrilla[] {
  const paso = (datos.bucket_seg ?? datos.intervalo_seg) * 1000
  const grilla: PuntoGrilla[] = []

  let anterior: number | null = null
  for (const punto of datos.puntos) {
    const t = new Date(punto.bucket).getTime()
    if (anterior !== null && t - anterior > FACTOR_HUECO * paso) {
      grilla.push({ t: (anterior + t) / 2, valor: null })
    }
    grilla.push({ t, valor: punto.promedio })
    anterior = t
  }
  return grilla
}
