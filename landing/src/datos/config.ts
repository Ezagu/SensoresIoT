// Fuente: Main.dc.html, defaults de data-props (línea 1562). Duración de
// cada fase del ciclo del hero, en milisegundos, y velocidades de la
// animación de la cola de transmisión.
export const CICLO_HERO_MS = {
  normal: 8000,
  espera: 8000,
  descarga: 6000,
  calma: 8000,
  alerta: 8000,
  retardoAviso: 2000,
} as const

export const COLA_MAX = 7

export const VELOCIDAD_MS = {
  entrada: 3000,
  salida: 2300,
  transicion: 1500,
} as const

export const CARRUSEL_SEGUNDOS = 4
