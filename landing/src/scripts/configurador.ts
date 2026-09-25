// Fuente: Main.dc.html — alternar()/vigilarConfigurador() (~línea 1624) y
// el tramo "configurador" de renderVals() (~línea 2121). `client:load`
// equivalente: los chips están sobre el fold en mobile, un IO ahí dejaría
// un tap sin respuesta.
import { SENSORES, ENERGIA, type ClaveModulo, type ClaveSensor } from '../datos/precios'
import { INICIALES, TODOS, avisoDe, mensajeDePedido, resumenDe, rotuloDe, seleccionInicial, totalDe } from '../datos/equipo'
import { linkWhatsApp } from '../datos/contacto'
import { AMBIENTES } from '../datos/ambientes'
import { dinero } from '../utiles/formato'
import { encuadrar } from './marco'
import { quieto } from './medios'
import { ubicarEnRanuras } from '../componentes/equipo/ranuras'

const sel = seleccionInicial()
/** Orden de elección: es lo que decide en qué ranura cae cada sensor. */
let orden: ClaveSensor[] = INICIALES.filter((k): k is ClaveSensor => SENSORES.includes(k as ClaveSensor))
let riel: 'sensores' | 'energia' = 'sensores'
/** El ambiente del que se partió; tocar un módulo a mano lo suelta. */
let preset: number | null = null
let barra = false
let delta = 0
let deltaId = 0
let deltaTimer: number | null = null

/** Cambiar un texto de lugar en el resumen es un cambio de estado: se ve. */
function escribir(el: HTMLElement | null, valor: string) {
  if (!el || el.textContent === valor) return
  el.textContent = valor
  if (quieto) return
  el.animate?.(
    [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
    { duration: 260, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  )
}

function aplicar(animar = true) {
  ubicarEnRanuras('mod', orden.filter((k) => sel[k]))
  TODOS.forEach((k) => {
    const btn = document.getElementById(`chip-${k}`)
    if (btn) {
      btn.classList.toggle('on', sel[k])
      btn.setAttribute('aria-pressed', String(sel[k]))
    }
    document.getElementById(`mod-${k}`)?.classList.toggle('on', sel[k])
  })

  document.getElementById('unit-gw')?.classList.toggle('on', sel.gw)
  document.getElementById('equipo-outer')?.classList.toggle('has-gw', sel.gw)

  const svg = document.getElementById('equipo-svg')
  if (svg) {
    encuadrar(svg, sel, animar)
    svg.setAttribute(
      'aria-label',
      sel.gw
        ? 'Tu equipo con los módulos elegidos y el gateway LoRa como segundo equipo'
        : 'Tu equipo con los módulos elegidos',
    )
  }

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

  escribir(document.getElementById('equipo-id'), rotuloDe(sel))

  const aviso = avisoDe(sel)
  const avisoEl = document.getElementById('aviso-enlace')
  if (avisoEl) {
    if (aviso) avisoEl.textContent = aviso
    avisoEl.hidden = !aviso
  }

  const resumenTexto = resumenDe(sel)
  const totalTexto = dinero(totalDe(sel))
  escribir(document.getElementById('resumen-texto'), resumenTexto)
  escribir(document.getElementById('total'), totalTexto)
  // Contacto repite el mismo resumen y el mismo pedido
  escribir(document.getElementById('resumen-texto-contacto'), resumenTexto)
  escribir(document.getElementById('total-contacto'), totalTexto)

  const pedido = linkWhatsApp(mensajeDePedido(sel, preset === null ? undefined : AMBIENTES[preset].nombre))
  document.getElementById('pedir')?.setAttribute('href', pedido)
  document.getElementById('pedir-contacto')?.setAttribute('href', pedido)

  document.getElementById('sumbar')?.classList.toggle('a-la-vista', barra)

  const deltaEl = document.getElementById('delta')
  if (deltaEl) {
    deltaEl.textContent = delta > 0 ? `+ ${dinero(delta)}` : delta < 0 ? `− ${dinero(Math.abs(delta))}` : ''
    deltaEl.classList.toggle('up', delta > 0)
    deltaEl.classList.toggle('down', delta < 0)
  }
}

/** temp/hum son gratis: un delta "+ US$ 0" no dice nada, así que sólo se
 *  anima cuando de verdad cambia el total. */
function marcarDelta(antes: number) {
  const monto = totalDe(sel) - antes
  if (monto === 0) return
  const id = deltaId + 1
  deltaId = id
  delta = monto
  if (deltaTimer) clearTimeout(deltaTimer)
  deltaTimer = window.setTimeout(() => {
    if (deltaId === id) {
      delta = 0
      aplicar()
    }
  }, 1600)
}

function alternar(clave: ClaveModulo) {
  const antes = totalDe(sel)
  const encendido = !sel[clave]
  sel[clave] = encendido
  // El módulo LoRa no sirve sin un gateway que lo escuche: entran y salen
  // juntos. Quitar el gateway a mano queda permitido (avisoDe lo explica).
  if (clave === 'lora') sel.gw = encendido
  if (SENSORES.includes(clave as ClaveSensor)) {
    const s = clave as ClaveSensor
    orden = encendido ? [...orden.filter((k) => k !== s), s] : orden.filter((k) => k !== s)
  }
  preset = null
  marcarDelta(antes)
  aplicar()
}

function partirDe(i: number) {
  const antes = totalDe(sel)
  const mods = AMBIENTES[i].mods
  TODOS.forEach((k) => {
    sel[k] = Boolean(mods[k])
  })
  orden = SENSORES.filter((k) => sel[k])
  preset = i
  marcarDelta(antes)
  aplicar()
}

TODOS.forEach((k) => {
  document.getElementById(`chip-${k}`)?.addEventListener('click', () => alternar(k))
})

// "Usar este preset" del carrusel de ambientes
document.addEventListener('usar-ambiente', (e) => partirDe((e as CustomEvent<number>).detail))

document.getElementById('seg-sensores')?.addEventListener('click', () => {
  riel = 'sensores'
  aplicar()
})
document.getElementById('seg-energia')?.addEventListener('click', () => {
  riel = 'energia'
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

// el primer encuadre no se anima: el SSR trae el lienzo entero, no un estado
aplicar(false)
