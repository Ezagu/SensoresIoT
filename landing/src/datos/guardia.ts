// La serie es el dato de la sección: el trazo, la escala del eje, el punto de
// cruce y el número que se lee arriba salen todos de acá, así el valor no
// puede desmentir dónde está la línea.
//
// La calma ondula dentro de una décima y con pocas muestras a propósito: el
// valor se interpola contra el scroll, así que un ruido más grande o más
// frecuente hace parpadear el número a cada pixel.
export const UMBRAL = 8

export const VISTA = { ancho: 1200, alto: 240, arriba: 24, abajo: 30 } as const
const ESCALA = { min: 4.2, max: 11 } as const

export const SERIE = [
  4.80, 4.82, 4.85, 4.88, 4.90, 4.89, 4.86, 4.83, 4.80, 4.79,
  4.81, 4.84, 4.87, 4.90, 4.91, 4.89, 4.85, 4.82, 4.79, 4.78,
  4.80, 4.83, 4.86, 4.89, 4.91, 4.90, 4.87, 4.84, 4.82, 4.85,
  5.0, 5.3, 5.4, 5.8, 6.2, 6.3, 6.7, 7.1, 7.2, 7.6,
  7.9, 8.3, 8.4, 8.8, 9.2, 9.3, 9.7, 10.1, 10.2, 10.6,
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

export const TRAMO_CALMA = listar([...hasta(0, indiceCruce), CRUCE])
export const TRAMO_ALERTA = listar([CRUCE, ...hasta(indiceCruce, SERIE.length)])
