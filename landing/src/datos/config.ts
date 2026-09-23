// Duración de cada fase del ciclo del hero, en milisegundos y en el orden en
// que corren: la alerta va segunda porque es lo que el equipo promete, y el
// corte con su buffer viene después, cuando ya se sabe para qué sirve la caja.
export const CICLO_HERO_MS = {
  normal: 3000,
  alerta: 8000,
  calma: 5000,
  espera: 5000,
  descarga: 4000,
  retardoAviso: 2000,
} as const

export const COLA_MAX = 7

export const VELOCIDAD_MS = {
  entrada: 3000,
  salida: 2300,
  transicion: 1500,
} as const

export const CARRUSEL_SEGUNDOS = 4
