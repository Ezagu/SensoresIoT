// La serie en vivo del celular del hero. Es determinista (el ruido sale del
// índice de la muestra), así el HTML del servidor y el script dibujan el
// mismo cuadro y el arranque no salta.
export const UMBRAL = 8
// la vuelta a la normalidad pide bajar un poco más que el umbral, como en el backend
const HISTERESIS = 0.3
// lecturas seguidas que confirman un cruce, en los dos sentidos
const CONFIRMACION = 3

export const VISTA = { ancho: 300, alto: 150, arriba: 12, abajo: 10 } as const
const ESCALA = { min: 3.6, max: 10 } as const

/** Cada cuánto entra una lectura en la demo. */
export const PASO_MS = 500
/** Lecturas visibles en el gráfico. */
export const VENTANA = 26

// El ciclo, en muestras: calma, sube, se queda arriba, baja.
const FASES = { calma: 12, subida: 7, alta: 13, bajada: 7 } as const
const CICLO = FASES.calma + FASES.subida + FASES.alta + FASES.bajada
const BASE = 4.8
const PICO = 9.1

/** Muestra con la que arranca la demo: recién confirmado el cruce, con el aviso a la vista. */
export const MUESTRA_INICIAL = 22

const suave = (t: number) => t * t * (3 - 2 * t)
const ruido = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 0.22
}

export function valorDe(n: number): number {
  const p = ((n % CICLO) + CICLO) % CICLO
  let base: number
  if (p < FASES.calma) base = BASE
  else if (p < FASES.calma + FASES.subida) base = BASE + (PICO - BASE) * suave((p - FASES.calma + 1) / FASES.subida)
  else if (p < FASES.calma + FASES.subida + FASES.alta) base = PICO
  else base = PICO - (PICO - BASE) * suave((p - FASES.calma - FASES.subida - FASES.alta + 1) / FASES.bajada)
  return base + ruido(n)
}

export type Estado = 'normal' | 'alerta'

/** El mismo criterio que evalúa el backend: cruce y vuelta confirmados por lecturas seguidas. */
export class Evaluador {
  estado: Estado = 'normal'
  private racha = 0

  /** Evalúa una lectura; devuelve true si cambió el estado. */
  evaluar(valor: number): boolean {
    const empuja = this.estado === 'normal' ? valor > UMBRAL : valor < UMBRAL - HISTERESIS
    this.racha = empuja ? this.racha + 1 : 0
    if (this.racha < CONFIRMACION) return false
    this.estado = this.estado === 'normal' ? 'alerta' : 'normal'
    this.racha = 0
    return true
  }
}

/** Evaluador ya puesto al día con la historia visible al llegar a la muestra `n`. */
export function evaluadorHasta(n: number): Evaluador {
  const ev = new Evaluador()
  for (let i = n - CICLO; i <= n; i++) ev.evaluar(valorDe(i))
  return ev
}

export const yDe = (valor: number) =>
  VISTA.arriba + ((ESCALA.max - valor) / (ESCALA.max - ESCALA.min)) * (VISTA.alto - VISTA.arriba - VISTA.abajo)

export const Y_UMBRAL = yDe(UMBRAL)

const PASO_X = VISTA.ancho / (VENTANA - 1)
const redondear = (n: number) => Math.round(n * 10) / 10

/**
 * El trazo en el instante `s` (muestra fraccionaria): las lecturas ya llegadas
 * se corren a la izquierda y la punta avanza hacia la próxima.
 */
export function trazoEn(s: number): { puntos: string; punta: [number, number] } {
  const ultima = Math.floor(s)
  const fraccion = s - ultima
  const pares: [number, number][] = []
  for (let i = ultima - VENTANA + 1; i <= ultima; i++) pares.push([VISTA.ancho - (s - i) * PASO_X, yDe(valorDe(i))])
  const vPunta = valorDe(ultima) + (valorDe(ultima + 1) - valorDe(ultima)) * fraccion
  const punta: [number, number] = [VISTA.ancho, yDe(vPunta)]
  pares.push(punta)
  return { puntos: pares.map(([x, y]) => `${redondear(x)},${redondear(y)}`).join(' '), punta }
}

/** Cuánto se ve cada canal antes de pasar al siguiente. */
export const CANAL_MS = 2600

export const CANALES = ['mail', 'whatsapp', 'telegram'] as const
