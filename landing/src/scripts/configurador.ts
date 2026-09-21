// Fuente: Main.dc.html — alternar()/vigilarConfigurador() (~línea 1624) y
// el tramo "configurador" de renderVals() (~línea 2121). `client:load`
// equivalente: los chips están sobre el fold en mobile, un IO ahí dejaría
// un tap sin respuesta.
import { BASE_USD, GATEWAY_USD, NOMBRES, PRECIOS, SENSORES, ENERGIA, precioDe, type ClaveModulo } from '../datos/precios'
import { dinero } from '../utiles/formato'
import { marco } from './marco'
import { observarMedia } from './medios'

const TODOS: ClaveModulo[] = [...SENSORES, ...ENERGIA]
const CON_PRECIO_VISIBLE: ClaveModulo[] = ['co2', 'suelo', 'uv', 'pres', 'bat', 'solar', 'lora', 'cel']

const sel: Record<ClaveModulo, boolean> = {
  temp: false, hum: false, co2: false, suelo: false, uv: false, pres: false,
  bat: false, solar: false, lora: false, cel: false,
}
let explode = false
let riel: 'sensores' | 'energia' = 'sensores'
let delta = 0
let deltaId = 0
let medio = false
let barra = false
let deltaTimer: number | null = null

function signo(k: ClaveModulo): string {
  return (sel[k] ? '− ' : '+ ') + dinero(PRECIOS[k])
}

function aplicar() {
  TODOS.forEach((k) => {
    const btn = document.getElementById(`chip-${k}`)
    if (btn) {
      btn.classList.toggle('on', sel[k])
      btn.setAttribute('aria-pressed', String(sel[k]))
    }
    if (CON_PRECIO_VISIBLE.includes(k)) {
      const pr = document.getElementById(`pr-${k}`)
      if (pr) pr.textContent = signo(k)
    }
    document.getElementById(`mod-${k}`)?.classList.toggle('on', sel[k])
  })

  document.getElementById('unit-gw')?.classList.toggle('on', sel.lora)
  document.getElementById('equipo-outer')?.classList.toggle('has-gw', sel.lora)
  const gwEstado = document.getElementById('gw-estado')
  if (gwEstado) gwEstado.textContent = sel.lora ? 'entra con LoRa' : 'sólo con LoRa'
  const chipGw = document.getElementById('chip-gw') as HTMLElement | null
  if (chipGw) chipGw.style.opacity = sel.lora ? '1' : '0.45'

  const svg = document.getElementById('equipo-svg')
  if (svg) {
    svg.setAttribute('class', explode ? 'device exploded' : 'device')
    svg.setAttribute('viewBox', marco(sel, explode, medio))
    svg.setAttribute(
      'aria-label',
      sel.lora
        ? 'Tu equipo con los módulos elegidos y el gateway LoRa como segundo equipo'
        : 'Tu equipo con los módulos elegidos',
    )
  }
  const btnExplode = document.getElementById('btn-explode')
  if (btnExplode) {
    btnExplode.classList.toggle('on', explode)
    btnExplode.setAttribute('aria-pressed', String(explode))
  }

  let hayLecturas = false
  SENSORES.forEach((k) => {
    const el = document.getElementById(`m-${k}`)
    if (el) {
      el.hidden = !sel[k]
      if (sel[k]) hayLecturas = true
    }
  })
  const vacio = document.getElementById('m-vacio')
  if (vacio) vacio.hidden = hayLecturas

  const nSens = SENSORES.filter((k) => sel[k]).length
  const nEner = ENERGIA.filter((k) => sel[k]).length
  const enSensores = riel !== 'energia'
  const segSens = document.getElementById('seg-sensores')
  const segEner = document.getElementById('seg-energia')
  segSens?.classList.toggle('on', enSensores)
  segSens?.setAttribute('aria-pressed', String(enSensores))
  segEner?.classList.toggle('on', !enSensores)
  segEner?.setAttribute('aria-pressed', String(!enSensores))
  const cuentaSens = document.getElementById('cuenta-sensores')
  if (cuentaSens) cuentaSens.textContent = nSens ? String(nSens) : ''
  const cuentaEner = document.getElementById('cuenta-energia')
  if (cuentaEner) cuentaEner.textContent = nEner ? String(nEner) : ''
  document.getElementById('rail-sensores')?.classList.toggle('oculto', !enSensores)
  document.getElementById('rail-energia')?.classList.toggle('oculto', enSensores)

  const cuantos = nSens + nEner
  const equipoId = document.getElementById('equipo-id')
  if (equipoId) {
    equipoId.textContent = cuantos ? `B—01 · ${cuantos}${cuantos === 1 ? ' módulo' : ' módulos'}` : 'B—01 · equipo base'
  }

  let total = BASE_USD
  const puestos: string[] = []
  TODOS.forEach((k) => {
    if (sel[k]) {
      total += PRECIOS[k]
      puestos.push(NOMBRES[k])
    }
  })
  if (sel.lora) {
    total += GATEWAY_USD
    puestos.push('gateway LoRa')
  }

  const resumenTexto = cuantos ? `Equipo base + ${puestos.join(', ')}` : 'Equipo base, todavía sin módulos'
  const totalTexto = dinero(total)
  const resumenEl = document.getElementById('resumen-texto')
  if (resumenEl) resumenEl.textContent = resumenTexto
  const totalEl = document.getElementById('total')
  if (totalEl) totalEl.textContent = totalTexto
  // La sección de cierre repite el mismo resumen (Main.dc.html reusa
  // resumenTexto/total ahí también).
  const resumenCierre = document.getElementById('resumen-texto-cierre')
  if (resumenCierre) resumenCierre.textContent = resumenTexto
  const totalCierre = document.getElementById('total-cierre')
  if (totalCierre) totalCierre.textContent = totalTexto

  document.getElementById('sumbar')?.classList.toggle('a-la-vista', barra)

  const deltaEl = document.getElementById('delta')
  if (deltaEl) {
    deltaEl.textContent = delta > 0 ? `+ ${dinero(delta)}` : delta < 0 ? `− ${dinero(Math.abs(delta))}` : ''
    deltaEl.classList.toggle('up', delta > 0)
    deltaEl.classList.toggle('down', delta < 0)
  }
}

function alternar(clave: ClaveModulo) {
  const encendido = !sel[clave]
  sel[clave] = encendido
  const monto = precioDe(clave)
  // temp/hum son gratis (GRATIS fijo en el chip): no vale la pena mostrar
  // un delta "+ US$ 0", así que sólo se anima cuando de verdad cambia el
  // total — refinamiento directo del fix del bug precioDe()/P desunificados.
  if (monto !== 0) {
    const id = deltaId + 1
    deltaId = id
    delta = encendido ? monto : -monto
    if (deltaTimer) clearTimeout(deltaTimer)
    deltaTimer = window.setTimeout(() => {
      if (deltaId === id) {
        delta = 0
        aplicar()
      }
    }, 1600)
  }
  aplicar()
}

TODOS.forEach((k) => {
  document.getElementById(`chip-${k}`)?.addEventListener('click', () => alternar(k))
})

document.getElementById('btn-explode')?.addEventListener('click', () => {
  explode = !explode
  aplicar()
})

document.getElementById('seg-sensores')?.addEventListener('click', () => {
  riel = 'sensores'
  aplicar()
})
document.getElementById('seg-energia')?.addEventListener('click', () => {
  riel = 'energia'
  aplicar()
})

observarMedia('(max-width: 1120px)', (coincide) => {
  medio = coincide
  aplicar()
})

const equipo = document.getElementById('equipo')
if (equipo && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        barra = e.isIntersecting
        aplicar()
      })
    },
    { threshold: 0, rootMargin: '-20% 0px -30% 0px' },
  )
  io.observe(equipo)
} else {
  barra = true
}

aplicar()
