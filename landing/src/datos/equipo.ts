// Lo que se puede decir del equipo armado: total, resumen, rótulo y avisos.
// Son funciones puras sobre la selección porque el mismo texto lo escriben el
// render del servidor (Configurador.astro) y el configurador en el navegador.
import { BASE_USD, ENERGIA, NOMBRES, PRECIOS, SENSORES, type ClaveModulo } from './precios'

export type Seleccion = Record<ClaveModulo, boolean>

export const TODOS: ClaveModulo[] = [...SENSORES, ...ENERGIA]

/** Temperatura y humedad vienen puestas: son las que no cambian el precio. */
export const INICIALES: ClaveModulo[] = ['temp', 'hum']

export function seleccionInicial(): Seleccion {
  return Object.fromEntries(TODOS.map((k) => [k, INICIALES.includes(k)])) as Seleccion
}

export function puestos(sel: Seleccion): ClaveModulo[] {
  return TODOS.filter((k) => sel[k])
}

export function totalDe(sel: Seleccion): number {
  return puestos(sel).reduce((total, k) => total + PRECIOS[k], BASE_USD)
}

export function resumenDe(sel: Seleccion): string {
  const p = puestos(sel)
  return p.length ? `Equipo base + ${p.map((k) => NOMBRES[k]).join(', ')}` : 'Equipo base, todavía sin módulos'
}

export function rotuloDe(sel: Seleccion): string {
  const n = puestos(sel).length
  return n ? `B—01 · ${n}${n === 1 ? ' módulo' : ' módulos'}` : 'B—01 · equipo base'
}

// El módulo LoRa y el gateway son las dos mitades de un mismo enlace: cada uno
// por su cuenta es plata gastada en algo que no transmite. Ninguna de las dos
// combinaciones se bloquea —comprar sólo el equipo para un gateway que ya está
// instalado es un pedido legítimo— pero las dos se avisan.
export function avisoDe(sel: Seleccion): string | null {
  if (sel.lora && !sel.gw) {
    return 'El módulo LoRa necesita un gateway para llegar a internet. Seguí sin él sólo si ya tenés uno instalado.'
  }
  if (sel.gw && !sel.lora) {
    return 'El gateway sólo recibe equipos con módulo LoRa. Sumale el módulo al equipo o sacá el gateway.'
  }
  return null
}
