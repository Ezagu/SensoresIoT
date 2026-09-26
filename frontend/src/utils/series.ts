import type { DatosGrafico } from '@/tipos'

export type PuntoGrilla = { t: number; valor: number | null }

/* Cuánto más grande que el ritmo de al lado tiene que ser una separación para
   que sea un corte de reporte y no jitter. */
const FACTOR_HUECO = 1.8

type Tramo = { desde: number; hasta: number; hueco: boolean; paso: number }

/* El paso contra el que se mide un hueco sale de la propia serie y NO de
   `intervalo_seg`, que es la config de hoy aplicada a datos grabados con la de
   entonces: bajar un equipo de 30 min a 1 min convertía todo su historial en
   puntos sueltos, y subirlo de 1 min a 30 min tapaba con una línea recta
   cualquier corte de menos de 45 min. Además `intervalo_efectivo_seg` cambia
   solo cuando vence una suscripción, sin que nadie toque nada.

   El vecino MAYOR y no la mediana ni el menor: en el escalón entre dos cadencias
   el delta grande tiene un vecino grande, así que no se marca; un corte real
   tiene vecinos chicos de los dos lados y sí. Sobre una serie de cadencia
   estable el resultado es el mismo que antes. */
function tramosDe(datos: DatosGrafico): Tramo[] {
  const instantes = datos.puntos.map((p) => new Date(p.bucket).getTime())
  const deltas = instantes.slice(1).map((t, i) => t - instantes[i])

  return deltas.map((delta, i) => {
    let paso: number
    if (datos.bucket_seg !== null) {
      // Agregado: el bucket es propiedad de la consulta, no del equipo, así que
      // vale igual para toda la serie por vieja que sea.
      paso = datos.bucket_seg * 1000
    } else {
      const izquierda = i > 0 ? deltas[i - 1] : null
      const derecha = i + 1 < deltas.length ? deltas[i + 1] : null

      if (izquierda !== null && derecha !== null) {
        paso = Math.max(izquierda, derecha)
      } else {
        // En un extremo falta la mitad del contexto, así que entra `intervalo_seg`
        // como piso: es la única pista que queda, y quedarse con la estimación más
        // generosa hace que un extremo se marque sólo si es grande para las dos.
        // Sin eso, una ráfaga de 15 s (el flush que adelanta un cruce de umbral)
        // pegada al borde arrastra la referencia y parte el trazo de mentira.
        const vecino = izquierda ?? derecha ?? 0
        paso = Math.max(vecino, datos.intervalo_seg * 1000)
      }
    }

    return {
      desde: instantes[i],
      hasta: instantes[i + 1],
      hueco: delta > FACTOR_HUECO * paso,
      paso,
    }
  })
}

/* Un hueco corta el trazo en vez de interpolar: el silencio de un equipo es la
   única señal de que se calló y tiene que verse. */
export function serieDeGrafico(datos: DatosGrafico): PuntoGrilla[] {
  const tramos = tramosDe(datos)
  const grilla: PuntoGrilla[] = []

  datos.puntos.forEach((punto, i) => {
    const tramo = i > 0 ? tramos[i - 1] : null
    if (tramo && tramo.hueco) {
      grilla.push({ t: (tramo.desde + tramo.hasta) / 2, valor: null })
    }
    grilla.push({ t: new Date(punto.bucket).getTime(), valor: punto.promedio })
  })

  return grilla
}

export type Huecos = { cortes: number; faltantes: number }

/* Cuántas lecturas faltan, no cuántos cortes hay: un corte puede valer una
   lectura o quinientas, y lo que hay que poder decir en voz alta es el tamaño
   del silencio. Cuenta sobre los mismos tramos que corta `serieDeGrafico`, para
   que lo que se cuenta sea exactamente lo que se ve cortado. */
export function huecosDeGrafico(datos: DatosGrafico): Huecos {
  let cortes = 0
  let faltantes = 0

  for (const tramo of tramosDe(datos)) {
    if (!tramo.hueco) continue
    cortes++
    faltantes += Math.max(1, Math.round((tramo.hasta - tramo.desde) / tramo.paso) - 1)
  }

  return { cortes, faltantes }
}

type Extremo = { valor: number; t: number }

export type Estadisticas = {
  minimo: Extremo | null
  maximo: Extremo | null
  /* null = el sensor no tiene reglas: no hay rango contra el cual medir. */
  fueraDeRango: { ms: number; veces: number } | null
  sinLecturas: { ms: number; desde: number } | null
}

/* Lo que la tira de métricas del sensor dice del período. Todo sobre los mismos
   tramos que dibuja el gráfico: un hueco no suma tiempo fuera de rango y lo que
   se cuenta como silencio es exactamente lo que se ve cortado. Con buckets el
   extremo sale del min/max del bucket, no del promedio que se dibuja. */
export function estadisticasDeGrafico(
  datos: DatosGrafico,
  umbrales: { umbral: number; condicion: 'mayor' | 'menor' }[],
): Estadisticas {
  const { puntos } = datos
  let minimo: Extremo | null = null
  let maximo: Extremo | null = null
  for (const p of puntos) {
    const t = new Date(p.bucket).getTime()
    if (!minimo || p.minimo < minimo.valor) minimo = { valor: p.minimo, t }
    if (!maximo || p.maximo > maximo.valor) maximo = { valor: p.maximo, t }
  }

  const fuera = (v: number) =>
    umbrales.some((u) => (u.condicion === 'mayor' ? v > u.umbral : v < u.umbral))
  const tramos = tramosDe(datos)

  let fueraMs = 0
  let veces = 0
  let silencioMs = 0
  let mayorSilencio: { ms: number; desde: number } | null = null
  tramos.forEach((tramo, i) => {
    const largo = tramo.hasta - tramo.desde
    if (tramo.hueco) {
      silencioMs += largo
      if (!mayorSilencio || largo > mayorSilencio.ms) mayorSilencio = { ms: largo, desde: tramo.desde }
      return
    }
    if (fuera(puntos[i].promedio)) fueraMs += largo
  })
  puntos.forEach((p, i) => {
    if (fuera(p.promedio) && (i === 0 || !fuera(puntos[i - 1].promedio))) veces++
  })

  return {
    minimo,
    maximo,
    fueraDeRango: umbrales.length ? { ms: fueraMs, veces } : null,
    sinLecturas: mayorSilencio ? { ms: silencioMs, desde: (mayorSilencio as { desde: number }).desde } : null,
  }
}
