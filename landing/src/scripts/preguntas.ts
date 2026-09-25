// El <details> nativo abre y cierra de golpe: acá se anima el alto de la
// respuesta. Sin JS sigue andando igual, sólo que sin animación.
import { quieto } from './medios'

const items = Array.from(document.querySelectorAll<HTMLDetailsElement>('.faq-item'))
const animaciones = new WeakMap<HTMLDetailsElement, Animation>()
const DURACION = 380
const CURVA = 'cubic-bezier(0.22, 1, 0.36, 1)'

function animar(item: HTMLDetailsElement, abrir: boolean) {
  const resp = item.querySelector<HTMLElement>('.faq-a')
  if (!resp) return
  // Arranca del alto actual: un click a mitad de camino revierte sin saltar.
  // Cerrado, la respuesta se sigue midiendo con su alto aunque no se vea.
  const desde = item.open ? resp.getBoundingClientRect().height : 0
  animaciones.get(item)?.cancel()

  item.classList.toggle('cerrando', !abrir)
  if (abrir) item.open = true
  const hasta = abrir ? resp.scrollHeight : 0

  if (quieto) {
    fin()
    return
  }
  const anim = resp.animate(
    [{ height: `${desde}px`, opacity: abrir ? 0.4 : 1 }, { height: `${hasta}px`, opacity: abrir ? 1 : 0 }],
    { duration: DURACION, easing: CURVA },
  )
  animaciones.set(item, anim)
  // cancelada por un click nuevo, la rechaza: ese click ya tomó el control
  anim.finished.then(fin, () => {})

  function fin() {
    animaciones.delete(item)
    item.classList.remove('cerrando')
    if (!abrir) item.open = false
  }
}

items.forEach((item) => {
  // con name, abrir una cierra la otra de golpe y le corta la animación
  item.removeAttribute('name')
  item.querySelector('summary')?.addEventListener('click', (e) => {
    e.preventDefault()
    const abierta = item.open && !item.classList.contains('cerrando')
    if (abierta) {
      animar(item, false)
      return
    }
    // acordeón exclusivo, como el name="preguntas" nativo
    items.forEach((otro) => {
      if (otro !== item && otro.open && !otro.classList.contains('cerrando')) animar(otro, false)
    })
    animar(item, true)
  })
})
