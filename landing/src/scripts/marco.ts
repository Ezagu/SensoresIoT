// Port de Main.dc.html marco() (~línea 1823). El encuadre sale de lo que el
// equipo tiene puesto: el recuadro ocupa lo necesario y el dibujo queda
// centrado en cualquier ancho.
//
// Las cajas de los módulos se miden con getBBox() en vez de estar tabuladas:
// la tabla a mano se desincronizaba en silencio cada vez que alguien movía una
// pieza, y el síntoma aparecía sólo en mobile. La única caja literal que queda
// es la del equipo base (el gabinete y su cable), que no es un módulo.
import type { ClaveModulo } from '../datos/precios'
import type { Seleccion } from '../datos/equipo'
import { quieto } from './medios'

type Caja = [number, number, number, number]

const BASE: Caja = [192, 174, 448, 494]
const GATEWAY: Caja = [576, 180, 742, 476]


function medir(clave: ClaveModulo): Caja | null {
  const g = document.getElementById(`mod-${clave}`)
  if (!g) return null

  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity

  g.querySelectorAll<SVGGraphicsElement>('[data-pos]').forEach((grupo) => {
    const t = grupo.getAttribute('transform')
    const [, tx = '0', ty = '0'] = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(t ?? '') ?? []
    grupo.querySelectorAll<SVGGraphicsElement>(':scope > *').forEach((el) => {
      const b = el.getBBox()
      if (!b.width && !b.height) return
      x0 = Math.min(x0, b.x + +tx)
      y0 = Math.min(y0, b.y + +ty)
      x1 = Math.max(x1, b.x + b.width + +tx)
      y1 = Math.max(y1, b.y + b.height + +ty)
    })
  })
  if (!Number.isFinite(x0)) return null
  return [x0, y0, x1, y1]
}

export function marco(sel: Seleccion): string {
  const dx = sel.gw ? 0 : 110
  let x0 = 1e5
  let y0 = 1e5
  let x1 = -1e5
  let y1 = -1e5

  const sumar = (c: Caja, corr: boolean) => {
    const d = corr ? dx : 0
    x0 = Math.min(x0, c[0] + d)
    y0 = Math.min(y0, c[1])
    x1 = Math.max(x1, c[2] + d)
    y1 = Math.max(y1, c[3])
  }

  sumar(BASE, true)
  Object.keys(sel).forEach((k) => {
    const clave = k as ClaveModulo
    if (!sel[clave]) return
    const caja = medir(clave)
    if (caja) sumar(caja, true)
  })
  if (sel.gw) sumar(GATEWAY, false)

  // El aire alrededor del equipo y el paso al que se redondea: cuanto más
  // grueso el paso, más salta el encuadre al prender un módulo.
  const AIRE = 12
  const q = 20
  x0 = Math.floor((x0 - AIRE) / q) * q
  y0 = Math.floor((y0 - AIRE) / q) * q
  x1 = Math.ceil((x1 + AIRE) / q) * q
  y1 = Math.ceil((y1 + AIRE) / q) * q
  let w = x1 - x0
  let h = y1 - y0
  const r = w / h
  // La banda de proporciones que puede tomar el recuadro: fuera de ella se
  // rellena con aire, así que va lo más ancha que el bloque tolere.
  const MIN = 0.8
  const MAX = 1.6
  if (r < MIN) {
    const nw = h * MIN
    x0 -= (nw - w) / 2
    w = nw
  } else if (r > MAX) {
    const nh = w / MAX
    y0 -= (nh - h) / 2
    h = nh
  }
  return [Math.round(x0), Math.round(y0), Math.round(w), Math.round(h)].join(' ')
}

const MS_ENCUADRE = 420
let cuadro: number | null = null

/** El viewBox no es animable por CSS, así que se interpola a mano: sumar un
 *  módulo que sobresale del gabinete tiene que ser un zoom, no un salto. */
export function encuadrar(svg: Element, sel: Seleccion, animar = true) {
  if (cuadro) cancelAnimationFrame(cuadro)
  const destino = marco(sel).split(' ').map(Number)
  const desde = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number)
  if (!animar || quieto || desde.length !== 4 || desde.some(Number.isNaN)) {
    svg.setAttribute('viewBox', destino.join(' '))
    return
  }
  const inicio = performance.now()
  const paso = (ahora: number) => {
    const t = Math.min(1, (ahora - inicio) / MS_ENCUADRE)
    const e = 1 - (1 - t) ** 3
    svg.setAttribute('viewBox', desde.map((v, i) => Math.round(v + (destino[i] - v) * e)).join(' '))
    if (t < 1) cuadro = requestAnimationFrame(paso)
  }
  cuadro = requestAnimationFrame(paso)
}
