// Port de Main.dc.html marco() (~línea 1823). Abajo de 1120px el equipo pasa a
// ocupar todo el ancho, así que ahí conviene encuadrarlo según lo que tiene
// puesto; arriba de eso queda el encuadre fijo del desktop.
//
// Las cajas de los módulos se miden con getBBox() en vez de estar tabuladas:
// la tabla a mano se desincronizaba en silencio cada vez que alguien movía una
// pieza, y el síntoma aparecía sólo en mobile. La única caja literal que queda
// es la del equipo base (el gabinete y su cable), que no es un módulo.
import type { ClaveModulo } from '../datos/precios'
// Misma tabla que alimenta el CSS por custom property; getBBox() no ve el
// transform del CSS, así que la explosión hay que sumarla acá a mano.
import { EXPLOSION as EXPL } from '../componentes/equipo/ranuras'

type Seleccion = Record<ClaveModulo, boolean>
type Caja = [number, number, number, number]

const BASE: Caja = [192, 174, 448, 494]
const GATEWAY: Caja = [556, 158, 776, 476]


/** La etiqueta sólo cuenta cuando se ve; si no, infla la caja más que la pieza. */
function medir(clave: ClaveModulo, conEtiquetas: boolean): Caja | null {
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
      if (!conEtiquetas && el.classList.contains('tag')) return
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

export function marco(sel: Seleccion, explode: boolean, encuadrar: boolean): string {
  if (!encuadrar) return '0 0 780 600'

  const dx = sel.lora ? 0 : 110
  let x0 = 1e5
  let y0 = 1e5
  let x1 = -1e5
  let y1 = -1e5

  const sumar = (c: Caja, o: [number, number] | null, corr: boolean) => {
    const d = corr ? dx : 0
    const ox = o ? o[0] : 0
    const oy = o ? o[1] : 0
    x0 = Math.min(x0, c[0] + ox + d)
    y0 = Math.min(y0, c[1] + oy)
    x1 = Math.max(x1, c[2] + ox + d)
    y1 = Math.max(y1, c[3] + oy)
  }

  sumar(BASE, null, true)
  Object.keys(EXPL).forEach((k) => {
    const clave = k as ClaveModulo
    if (!sel[clave]) return
    const caja = medir(clave, explode)
    if (caja) sumar(caja, explode ? EXPL[k] : null, true)
  })
  if (sel.lora) sumar(GATEWAY, null, false)

  const q = 40
  x0 = Math.floor((x0 - 20) / q) * q
  y0 = Math.floor((y0 - 20) / q) * q
  x1 = Math.ceil((x1 + 20) / q) * q
  y1 = Math.ceil((y1 + 20) / q) * q
  let w = x1 - x0
  let h = y1 - y0
  const r = w / h
  const MIN = 0.92
  const MAX = 1.45
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
