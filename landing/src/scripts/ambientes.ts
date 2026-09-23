// El carrusel de ambientes: prende el lugar de fondo, le pone al equipo los
// módulos de ese ambiente y reacomoda las ranuras. El equipo es el mismo
// componente del configurador, así que acá no se dibuja nada: se prende.
import { AMBIENTES } from '../datos/ambientes'
import { CARRUSEL_SEGUNDOS } from '../datos/config'
import { TODOS } from '../datos/equipo'
import { SENSORES } from '../datos/precios'
import { ubicarEnRanuras } from '../componentes/equipo/ranuras'
import { observarMedia, quieto } from './medios'

const svg = document.getElementById('ambiente-svg')
const carrusel = document.getElementById('carrusel')
const infoNombre = document.getElementById('ambiente-nombre')
const infoConfig = document.getElementById('ambiente-config')
const slideInfo = document.getElementById('slide-info')

if (svg && carrusel && infoNombre && infoConfig && slideInfo) {
  let slide = 0
  let nav = 0
  let compacto = false
  let carTimer: number | null = null
  let cuenta: Animation | null = null
  let arrastreX: number | null = null
  // Mover el carrusel a mano es tomar el control: no se lo devolvemos solo.
  let automatico = true

  const puntos = Array.from(document.querySelectorAll<HTMLButtonElement>('#puntos .punto'))

  function aplicar() {
    const amb = AMBIENTES[slide]

    AMBIENTES.forEach((_, i) => {
      document.getElementById(`esc-${i}`)?.classList.toggle('on', i === slide)
    })

    ubicarEnRanuras('amb', SENSORES.filter((k) => amb.mods[k]))
    TODOS.forEach((k) => {
      document.getElementById(`amb-${k}`)?.classList.toggle('on', Boolean(amb.mods[k]))
    })
    document.getElementById('amb-outer')?.classList.toggle('has-gw', Boolean(amb.mods.gw))

    svg!.setAttribute('viewBox', compacto ? amb.vista : '0 0 1240 500')
    svg!.setAttribute('aria-label', amb.alt)

    slideInfo!.setAttribute('class', `slide-info ${nav % 2 === 0 ? 'fd-a' : 'fd-b'}`)
    infoNombre!.textContent = amb.nombre
    infoConfig!.textContent = amb.config

    puntos.forEach((btn, i) => btn.classList.toggle('on', i === slide))
  }

  /** La barra del punto activo es el tiempo que falta, así que se dibuja con
   *  la misma espera que está corriendo. Cancelada, el CSS la deja llena. */
  function contar(ms: number) {
    const barra = puntos[slide]?.querySelector('.punto-barra')
    cuenta = barra?.animate?.(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: ms, easing: 'linear', fill: 'forwards' },
    ) ?? null
  }

  function detener() {
    if (carTimer) clearTimeout(carTimer)
    carTimer = null
    cuenta?.cancel()
    cuenta = null
  }

  function programarCarrusel() {
    detener()
    if (!automatico || quieto) return
    const espera = Math.max(2000, Math.round(CARRUSEL_SEGUNDOS * 1000))
    carTimer = window.setTimeout(() => irA(slide + 1), espera)
    contar(espera)
  }

  function irA(i: number, aMano = false) {
    if (aMano) automatico = false
    const total = AMBIENTES.length
    slide = ((i % total) + total) % total
    nav++
    aplicar()
    programarCarrusel()
  }

  document.getElementById('car-prev')?.addEventListener('click', () => irA(slide - 1, true))
  document.getElementById('car-next')?.addEventListener('click', () => irA(slide + 1, true))
  puntos.forEach((btn) => {
    btn.addEventListener('click', () => irA(Number(btn.dataset.i), true))
  })

  carrusel.addEventListener('pointerdown', (e) => {
    arrastreX = e.clientX
    detener()
  })
  carrusel.addEventListener('pointerup', (e) => {
    const d = arrastreX !== null ? e.clientX - arrastreX : 0
    arrastreX = null
    if (Math.abs(d) > 40) irA(d < 0 ? slide + 1 : slide - 1, true)
    else programarCarrusel()
  })
  carrusel.addEventListener('pointerleave', () => {
    arrastreX = null
    programarCarrusel()
  })

  // El avance se frena mientras lo estás mirando: con el puntero encima o con
  // el foco adentro. En táctil no aplica (ahí frena el pointerdown).
  if (matchMedia('(hover: hover)').matches) {
    carrusel.addEventListener('pointerenter', detener)
  }
  carrusel.addEventListener('focusin', detener)
  carrusel.addEventListener('focusout', () => {
    if (!carrusel.matches(':focus-within')) programarCarrusel()
  })

  observarMedia('(max-width: 720px)', (coincide) => {
    compacto = coincide
    aplicar()
  })

  aplicar()

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) programarCarrusel()
        else detener()
      })
    })
    io.observe(carrusel)
  } else {
    programarCarrusel()
  }
}
