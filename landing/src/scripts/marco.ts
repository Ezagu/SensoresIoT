// Port verbatim de Main.dc.html marco() (~línea 1823). Abajo de 1120px el
// equipo pasa a ocupar todo el ancho, así que ahí conviene encuadrarlo según
// lo que tiene puesto; arriba de eso queda el encuadre fijo del desktop.
import type { ClaveModulo } from '../datos/precios'

type Seleccion = Record<ClaveModulo, boolean>

const CAJAS: Record<string, [number, number, number, number]> = {
  base: [130, 150, 490, 514],
  solar: [150, 26, 470, 144],
  lora: [432, 104, 500, 172],
  cel: [458, 300, 544, 380],
  bat: [74, 238, 184, 394],
  pres: [112, 316, 190, 346],
  uv: [286, 146, 370, 174],
  temp: [428, 190, 488, 268],
  hum: [428, 278, 496, 358],
  co2: [236, 400, 384, 478],
  suelo: [116, 458, 282, 542],
}

const EXPL: Record<string, [number, number]> = {
  solar: [0, -52],
  bat: [-56, 0],
  lora: [40, -32],
  cel: [50, 14],
  temp: [64, -20],
  hum: [64, 26],
  co2: [0, 54],
  suelo: [-42, 44],
  uv: [0, -44],
  pres: [-54, 0],
}

export function marco(sel: Seleccion, explode: boolean, encuadrar: boolean): string {
  if (!encuadrar) return '0 0 780 600'

  const dx = sel.lora ? 0 : 110
  let x0 = 1e5
  let y0 = 1e5
  let x1 = -1e5
  let y1 = -1e5

  const sumar = (c: [number, number, number, number], o: [number, number] | null, corr: boolean) => {
    const d = corr ? dx : 0
    const ox = o ? o[0] : 0
    const oy = o ? o[1] : 0
    x0 = Math.min(x0, c[0] + ox + d)
    y0 = Math.min(y0, c[1] + oy)
    x1 = Math.max(x1, c[2] + ox + d)
    y1 = Math.max(y1, c[3] + oy)
  }

  sumar(CAJAS.base, null, true)
  Object.keys(EXPL).forEach((k) => {
    if (sel[k as ClaveModulo]) sumar(CAJAS[k], explode ? EXPL[k] : null, true)
  })
  if (sel.lora) sumar([520, 128, 762, 492], null, false)

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
