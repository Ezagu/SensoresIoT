import type { DatosGrafico } from '@/tipos'

export type PuntoGrilla = { t: number; valor: number | null }

/* El paso lo dice el backend: el bucket si agregó, el intervalo de muestreo si
   devolvió lecturas crudas. Una separación mayor es un corte de reporte y no
   jitter, y corta el trazo: es la única señal de que un equipo se calló. */
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

export type Huecos = { cortes: number; faltantes: number }

/* Cuántas lecturas faltan, no cuántos cortes hay: un corte puede valer una
   lectura o quinientas, y lo que hay que poder decir en voz alta es el tamaño
   del silencio. Mismo umbral que serieDeGrafico, para que lo que se cuenta sea
   exactamente lo que se ve cortado. */
export function huecosDeGrafico(datos: DatosGrafico): Huecos {
  const paso = (datos.bucket_seg ?? datos.intervalo_seg) * 1000
  let cortes = 0
  let faltantes = 0

  let anterior: number | null = null
  for (const punto of datos.puntos) {
    const t = new Date(punto.bucket).getTime()
    if (anterior !== null && t - anterior > FACTOR_HUECO * paso) {
      cortes++
      faltantes += Math.max(1, Math.round((t - anterior) / paso) - 1)
    }
    anterior = t
  }
  return { cortes, faltantes }
}
