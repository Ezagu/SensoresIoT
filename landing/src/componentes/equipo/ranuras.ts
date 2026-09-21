// La grilla de sensores adentro del gabinete. Un sensor no tiene posición
// propia: tiene ranura, y la posición sale de acá. Es lo que hace que sumar
// un sensor no sea negociar un hueco libre en el dibujo.
import type { ClaveSensor } from '../../datos/precios'

// El gabinete es cuadrado (256×256) y su interior es una sola columna de 196
// centrada en 320: el rótulo, las tres celdas y la placa arrancan y terminan
// todos ahí. La separación horizontal difiere de la vertical porque el ancho
// lo fija la columna y el alto lo fija el aire que queda hasta los tornillos.
export const INTERIOR = { x: 222, ancho: 196 }

export const RANURA = 58
const SEP_X = 11
const SEP_Y = 10
const COLUMNAS = 3
const X0 = INTERIOR.x
const Y0 = 242

// El orden de relleno real lo decide configurador.ts con el orden en que los
// fuiste eligiendo; esto es sólo el reparto por defecto, para el hero y para
// el primer render antes de que corra el JS.
export const RANURAS: Record<ClaveSensor, number> = {
  temp: 0, hum: 1, co2: 2, suelo: 3, uv: 4, pres: 5,
}

export const TOTAL_RANURAS = COLUMNAS * 2

export function ranura(i: number): [number, number] {
  return [
    X0 + (i % COLUMNAS) * (RANURA + SEP_X),
    Y0 + Math.floor(i / COLUMNAS) * (RANURA + SEP_Y),
  ]
}

export function ranuraDe(clave: ClaveSensor): [number, number] {
  return ranura(RANURAS[clave])
}

/** La placa: donde converge todo adentro del gabinete. */
export const PLACA = { x: INTERIOR.x, y: 378, w: INTERIOR.ancho, h: 22 }

// Cuánto se separa cada módulo en la vista explotada. Lo leen el CSS (por
// custom property, desde el componente) y marco.ts: una tabla, no dos.
// Los sensores se corren apenas: adentro del gabinete no hay a dónde tirarlos
// sin pisar el rótulo o la placa, y con el zócalo punteado atrás alcanza.
const FUERA_DEL_ZOCALO: [number, number] = [-12, 0]

export const EXPLOSION: Record<string, [number, number]> = {
  temp: FUERA_DEL_ZOCALO,
  hum: FUERA_DEL_ZOCALO,
  co2: FUERA_DEL_ZOCALO,
  suelo: FUERA_DEL_ZOCALO,
  uv: FUERA_DEL_ZOCALO,
  pres: FUERA_DEL_ZOCALO,
  solar: [0, -52],
  bat: [-56, 0],
  lora: [0, -76],
}
