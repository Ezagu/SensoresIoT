// Fuente: Main.dc.html — irA()/programarCarrusel()/alBajar/alSoltar
// (~línea 1634) y el tramo "ambientes" de renderVals() (~línea 2190).
// `client:visible` para el autoplay (no tiene sentido animar un carrusel
// fuera de pantalla), `client:load` para los controles.
import { AMBIENTES } from '../datos/ambientes'
import { CARRUSEL_SEGUNDOS } from '../datos/config'
import { observarMedia, quieto } from './medios'

const svg = document.getElementById('ambiente-svg')
const carrusel = document.getElementById('carrusel')
const infoNombre = document.getElementById('ambiente-nombre')
const infoConfig = document.getElementById('ambiente-config')
const slideInfo = document.getElementById('slide-info')
const slideDatos = document.getElementById('slide-datos')

if (svg && carrusel && infoNombre && infoConfig && slideInfo && slideDatos) {
  let slide = 0
  let nav = 0
  let compacto = false
  let carTimer: number | null = null
  let arrastreX: number | null = null

  const PIEZAS = ['temp', 'hum', 'co2', 'suelo', 'uv', 'bat', 'solar', 'lora', 'cel', 'gw'] as const

  function aplicar() {
    const amb = AMBIENTES[slide]

    AMBIENTES.forEach((_, i) => {
      document.getElementById(`esc-${i}`)?.classList.toggle('on', i === slide)
    })
    PIEZAS.forEach((k) => {
      document.getElementById(`pz-${k}`)?.classList.toggle('on', Boolean(amb.mods[k as keyof typeof amb.mods]))
    })

    svg!.setAttribute('viewBox', compacto ? amb.vista : '0 0 1200 460')
    svg!.setAttribute('aria-label', amb.alt)

    const fd = nav % 2 === 0 ? 'fd-a' : 'fd-b'
    slideInfo!.setAttribute('class', `slide-info ${fd}`)
    slideDatos!.setAttribute('class', `slide-datos ${fd}`)
    infoNombre!.textContent = amb.nombre
    infoConfig!.textContent = amb.config

    for (let i = 0; i < 3; i++) {
      const cont = document.getElementById(`dato-${i}`)
      const dato = amb.datos[i]
      if (!cont) continue
      cont.hidden = !dato
      if (dato) {
        document.getElementById(`dato-${i}-v`)!.textContent = dato.v
        document.getElementById(`dato-${i}-u`)!.textContent = dato.u
        document.getElementById(`dato-${i}-p`)!.setAttribute('points', dato.p)
      }
    }

    document.querySelectorAll<HTMLButtonElement>('#puntos .punto').forEach((btn, i) => {
      btn.classList.toggle('on', i === slide)
    })
  }

  function programarCarrusel() {
    if (carTimer) clearTimeout(carTimer)
    if (quieto) return
    const espera = Math.max(2000, Math.round(CARRUSEL_SEGUNDOS * 1000))
    carTimer = window.setTimeout(() => irA(slide + 1), espera)
  }

  function irA(i: number) {
    const total = AMBIENTES.length
    slide = ((i % total) + total) % total
    nav++
    aplicar()
    programarCarrusel()
  }

  document.getElementById('car-prev')?.addEventListener('click', () => irA(slide - 1))
  document.getElementById('car-next')?.addEventListener('click', () => irA(slide + 1))
  document.querySelectorAll<HTMLButtonElement>('#puntos .punto').forEach((btn) => {
    btn.addEventListener('click', () => irA(Number(btn.dataset.i)))
  })

  carrusel.addEventListener('pointerdown', (e) => {
    arrastreX = e.clientX
    if (carTimer) clearTimeout(carTimer)
  })
  carrusel.addEventListener('pointerup', (e) => {
    const x = e.clientX
    const d = arrastreX !== null ? x - arrastreX : 0
    arrastreX = null
    if (Math.abs(d) > 40) irA(d < 0 ? slide + 1 : slide - 1)
    else programarCarrusel()
  })
  carrusel.addEventListener('pointerleave', () => {
    arrastreX = null
    programarCarrusel()
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
        else if (carTimer) clearTimeout(carTimer)
      })
    })
    io.observe(carrusel)
  } else {
    programarCarrusel()
  }
}
