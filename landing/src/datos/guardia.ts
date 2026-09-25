// La serie es el dato de la sección: el trazo, la escala del eje, el punto de
// cruce y el número que se lee arriba salen todos de acá, así el valor no
// puede desmentir dónde está la línea.
//
// La calma ondula dentro de una décima y con pocas muestras a propósito: el
// valor se interpola contra el scroll, así que un ruido más grande o más
// frecuente hace parpadear el número a cada pixel. Termina en 9,2, el pico
// que Registro.astro tiene registrado para Cámara 1: el prólogo es ese episodio.
export const UMBRAL = 8

export const VISTA = { ancho: 1200, alto: 240, arriba: 24, abajo: 30 } as const
const ESCALA = { min: 4.2, max: 10 } as const

// La calma ocupa el primer tercio (índices 0-16) y cruza el umbral en el
// índice 34 de 49 (~69%) — ver AVANCE_CRUCE más abajo.
export const SERIE = [
  4.80, 4.82, 4.85, 4.88, 4.90, 4.89, 4.86, 4.83, 4.80, 4.79,
  4.81, 4.84, 4.87, 4.90, 4.91, 4.89, 4.85,
  4.90, 4.95, 5.05, 5.20, 5.38, 5.55, 5.75, 5.95, 6.15, 6.35,
  6.58, 6.80, 7.00, 7.20, 7.42, 7.60, 7.80, 8.00,
  8.15, 8.30, 8.45, 8.60, 8.72, 8.82, 8.90, 8.96, 9.02, 9.06,
  9.10, 9.13, 9.16, 9.18, 9.20,
]

// El trazo no arranca en cero: la sección entra con algo de historia ya
// dibujada, si no el primer cuadro es un gráfico vacío con media cabeza
// pegada al borde izquierdo.
export const DIBUJADO_INICIAL = 0.06

export const yDe = (valor: number) =>
  VISTA.arriba + ((ESCALA.max - valor) / (ESCALA.max - ESCALA.min)) * (VISTA.alto - VISTA.arriba - VISTA.abajo)

export const xDe = (indice: number) => (indice / (SERIE.length - 1)) * VISTA.ancho

/** Valor interpolado para un avance 0..1 del recorrido. */
export function valorEn(avance: number): number {
  const i = avance * (SERIE.length - 1)
  const a = Math.floor(i)
  const b = Math.min(a + 1, SERIE.length - 1)
  return SERIE[a] + (SERIE[b] - SERIE[a]) * (i - a)
}

export const Y_UMBRAL = yDe(UMBRAL)

function redondear(n: number): number {
  return Math.round(n * 10) / 10
}

const indiceCruce = SERIE.findIndex((v) => v >= UMBRAL)
// El trazo cambia de color en el cruce interpolado, no en la muestra siguiente:
// si el quiebre cayera en el punto, quedaría arriba de la línea de umbral.
const proporcion = (UMBRAL - SERIE[indiceCruce - 1]) / (SERIE[indiceCruce] - SERIE[indiceCruce - 1])
const CRUCE: [number, number] = [xDe(indiceCruce - 1 + proporcion), Y_UMBRAL]

const listar = (puntos: [number, number][]) =>
  puntos.map(([x, y]) => `${redondear(x)},${redondear(y)}`).join(' ')

const hasta = (desde: number, hastaExcl: number): [number, number][] =>
  SERIE.slice(desde, hastaExcl).map((v, k) => [xDe(desde + k), yDe(v)])

/** Avance (0..1) donde la serie cruza el umbral. */
export const AVANCE_CRUCE = (indiceCruce - 1 + proporcion) / (SERIE.length - 1)

/** Avance donde termina la calma: la primera muestra que sale de la décima en la que ondula. */
export const AVANCE_FIN_CALMA = SERIE.findIndex((v) => Math.abs(v - SERIE[0]) > 0.15) / (SERIE.length - 1)

export const TRAMO_CALMA = listar([...hasta(0, indiceCruce), CRUCE])
export const TRAMO_ALERTA = listar([CRUCE, ...hasta(indiceCruce, SERIE.length)])
