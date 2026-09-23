// La animación es el scroll: no hay timers ni "Ver otra vez". El avance sale
// de cuánto se recorrió .watch-pista, y de ahí salen el ancho del clip que
// revela el trazo, la posición de la cabeza y el valor que se lee.
import { AVANCE_CRUCE, AVANCE_FIN_CALMA, DIBUJADO_INICIAL, UMBRAL, VISTA, valorEn, yDe } from '../datos/guardia'

// Recorrido fijado (0..1) → avance del trazo. Lineal, la calma plana se comía
// el 61% del recorrido y la alerta quedaba en el último cuarto: acá la calma
// se cruza en un 25% y la alerta se sostiene el 40% final, que es lo que se
// tiene que alcanzar a leer.
const TRAMOS: [number, number][] = [
  [0.05, DIBUJADO_INICIAL],
  [0.3, AVANCE_FIN_CALMA],
  [0.6, AVANCE_CRUCE],
  [0.7, 1],
]
const RADIO = 5

const seccion = document.getElementById('guardia')
const pista = document.getElementById('watch-pista')
const svg = document.querySelector<SVGSVGElement>('.watch-svg')
const clip = document.getElementById('watch-clip')
const cabeza = document.getElementById('watch-cabeza')
const guia = document.getElementById('watch-guia')
const valor = document.getElementById('watch-valor')
const nota = document.getElementById('watch-nota')
const pillNormal = document.getElementById('pastilla-normal')
const pillCritical = document.getElementById('pastilla-critical')

if (seccion && pista && svg && clip && cabeza && guia && valor && nota && pillNormal && pillCritical) {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
  const fmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const recortar = (n: number) => Math.min(1, Math.max(0, n))

  // El viewBox se estira sin conservar proporción, así que la cabeza es una
  // elipse con los radios corregidos por la escala real de cada eje.
  function redondearCabeza() {
    const caja = svg!.getBoundingClientRect()
    if (!caja.width || !caja.height) return
    cabeza!.setAttribute('rx', String((RADIO * VISTA.ancho) / caja.width))
    cabeza!.setAttribute('ry', String((RADIO * VISTA.alto) / caja.height))
  }

  function avanceDe(t: number): number {
    if (t <= TRAMOS[0][0]) return TRAMOS[0][1]
    for (let i = 1; i < TRAMOS.length; i++) {
      const [t1, a1] = TRAMOS[i]
      if (t <= t1) {
        const [t0, a0] = TRAMOS[i - 1]
        return a0 + ((t - t0) / (t1 - t0)) * (a1 - a0)
      }
    }
    return 1
  }

  function pintar(avance: number) {
    const v = valorEn(avance)
    const x = avance * VISTA.ancho
    const y = yDe(v)
    const enAlerta = v >= UMBRAL

    clip!.setAttribute('width', String(x))
    cabeza!.setAttribute('cx', String(x))
    cabeza!.setAttribute('cy', String(y))
    guia!.setAttribute('x1', String(x))
    guia!.setAttribute('x2', String(x))
    guia!.setAttribute('y1', String(y))

    seccion!.classList.toggle('is-alerta', enAlerta)
    valor!.textContent = fmt.format(v)
    nota!.textContent = enAlerta
      ? 'Cruzó el umbral que definiste y salió el aviso. No tuviste que estar mirando.'
      : 'El equipo mide cada 15 a 20 segundos. Mientras el valor esté donde tiene que estar, acá no pasa nada.'
    pillNormal!.hidden = enAlerta
    pillCritical!.hidden = !enAlerta
  }

  function avanceActual(): number {
    const caja = pista!.getBoundingClientRect()
    const recorrido = caja.height - window.innerHeight
    if (recorrido <= 0) return 1
    return avanceDe(recortar(-caja.top / recorrido))
  }

  if (quieto) {
    redondearCabeza()
    pintar(1)
  } else {
    let pedido = false
    const actualizar = () => {
      if (pedido) return
      pedido = true
      requestAnimationFrame(() => {
        pedido = false
        pintar(avanceActual())
      })
    }

    redondearCabeza()
    pintar(avanceActual())
    addEventListener('scroll', actualizar, { passive: true })
    addEventListener('resize', () => {
      redondearCabeza()
      actualizar()
    })
  }
}

export {}
