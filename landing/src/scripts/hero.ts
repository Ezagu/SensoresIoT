// Fuente: Main.dc.html — cicloHero()/reiniciarHero() (~línea 1736).
// Traducción 1:1 salvo:
// - se gatea con IntersectionObserver + visibilitychange (el mockup corría
//   los timers para siempre, con el hero fuera de pantalla o en background);
// - riseCls/heroIn desaparecen (ver estilos/hero.css, animation con delay);
// - sin data-props: los tiempos y textos son los defaults de datos/config.ts
//   y datos/textos.ts.
import { TEXTOS_ESTADO, type FaseHero } from '../datos/textos'
import { CICLO_HERO_MS, COLA_MAX, VELOCIDAD_MS } from '../datos/config'

const svg = document.getElementById('hero-svg')
const ledHalo = document.getElementById('hero-led-halo')
const ledDot = document.getElementById('hero-led-dot')
const bufs = Array.from({ length: COLA_MAX }, (_, i) => document.getElementById(`buf-${i + 1}`))
const estadoCard = document.getElementById('estado-card')
const estadoTitulo = document.getElementById('estado-titulo')
const estadoSub = document.getElementById('estado-sub')
const estadoAvisa = document.getElementById('estado-avisa')
const flujo = document.querySelector<SVGGElement>('#hero-svg .flujo')
const seccion = document.getElementById('top')

if (svg && ledHalo && ledDot && estadoCard && estadoTitulo && estadoSub && estadoAvisa && flujo) {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches

  let fase: FaseHero = 'normal'
  let cola = 0
  let aviso = false
  // Dos relojes. `fase` es lo que hace el equipo —emite, llena y vacía el
  // buffer, destella al detectar—; `faseVista` es lo que el afuera sabe, y
  // llega un vuelo después, cuando el punto de ese estado sale por la antena.
  let faseVista: FaseHero = 'normal'
  let swap = 0
  let heroTimers: number[] = []

  // Una medición que ya salió termina su viaje como salió: el color y la
  // duración se congelan al emitirla en vez de colgar de una clase de fase,
  // que se las cambiaba en el aire a las que estaban a mitad de camino.
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const COLOR_SALIDA: Record<FaseHero, string | null> = {
    normal: 'var(--lp-ok)',
    espera: null, // sin conexión no sale nada
    descarga: 'var(--lp-amber)',
    alerta: 'var(--lp-warn-mark)',
  }
  const duracionSalida = () => (fase === 'descarga' ? Math.round(VELOCIDAD_MS.salida * 0.6) : VELOCIDAD_MS.salida)
  let emisor: number | null = null

  function emitirMedicion() {
    const color = COLOR_SALIDA[fase]
    if (!color) return
    const dur = duracionSalida()
    const punto = document.createElementNS(SVG_NS, 'circle')
    punto.setAttribute('r', '3.6')
    punto.setAttribute('class', 'dot dot-out')
    punto.style.fill = color
    punto.style.animationDuration = `${dur}ms`
    const quitar = () => punto.remove()
    punto.addEventListener('animationend', quitar)
    punto.addEventListener('animationcancel', quitar) // p. ej. si reduced-motion apaga la animación
    flujo!.appendChild(punto)
  }

  function emitir() {
    if (emisor !== null) return
    const paso = () => {
      emitirMedicion()
      emisor = window.setTimeout(paso, duracionSalida() / 2)
    }
    paso()
  }

  /** Corta la emisión y deja llegar lo que ya está en el aire. */
  function dejarDeEmitir() {
    if (emisor === null) return
    clearTimeout(emisor)
    emisor = null
  }

  function limpiarSalidas() {
    dejarDeEmitir()
    faseVista = 'normal'
    flujo!.querySelectorAll('.dot-out').forEach((e) => e.remove())
  }

  function aplicar() {
    const transmitiendo = faseVista !== 'espera'
    const descarga = faseVista === 'descarga'
    svg!.setAttribute(
      'class',
      // f-* es lo que se ve; det-alerta es el equipo detectando, que es inmediato
      ['device', 'hero-dev', 'rise', `f-${faseVista}`, fase === 'alerta' ? 'det-alerta' : '', transmitiendo ? 'tx' : '', descarga ? 'tx-rapido' : '']
        .filter(Boolean)
        .join(' '),
    )
    const color = faseVista === 'alerta' ? 'var(--lp-warn-mark)' : faseVista === 'espera' ? 'var(--lp-amber)' : 'var(--lp-ok)'
    ledHalo!.setAttribute('fill', color)
    ledDot!.setAttribute('fill', color)

    bufs.forEach((el, i) => el?.classList.toggle('on', cola > i))

    const tipo = faseVista === 'alerta' ? 'is-alerta' : faseVista === 'espera' || faseVista === 'descarga' ? 'is-espera' : 'is-normal'
    estadoCard!.setAttribute('class', `estado-card ${tipo} ${swap % 2 === 0 ? 'sw-a' : 'sw-b'}`)
    if (faseVista === 'alerta') estadoCard!.setAttribute('role', 'status')
    else estadoCard!.removeAttribute('role')

    const textos = TEXTOS_ESTADO[faseVista]
    estadoTitulo!.textContent = textos.titulo
    estadoSub!.textContent = textos.sub
    estadoAvisa!.hidden = !(faseVista === 'alerta' && aviso)

    svg!.setAttribute(
      'aria-label',
      faseVista === 'alerta'
        ? 'El equipo detecta una medición fuera de rango y la transmite por wi-fi'
        : faseVista === 'espera'
          ? 'Las mediciones llegan al equipo y quedan en cola hasta poder transmitirse'
          : 'Las mediciones viajan de los sensores al equipo y salen por la antena wi-fi',
    )
  }

  function limpiarHeroTimers() {
    heroTimers.forEach(clearTimeout)
    heroTimers = []
  }

  function cicloHero() {
    limpiarHeroTimers()
    const luego = (t: number, fn: () => void) => heroTimers.push(window.setTimeout(fn, t))
    const cuantas = COLA_MAX
    const vuelo = VELOCIDAD_MS.salida
    const vueloRapido = Math.round(vuelo * 0.6)
    /** El estado se ve cuando aterriza el punto que salió con él. */
    const verEn = (cuando: number, f: FaseHero) =>
      luego(cuando, () => {
        faseVista = f
        swap++
        aplicar()
      })
    let t = 0

    fase = 'normal'
    cola = 0
    aviso = false
    aplicar()
    emitir()
    verEn(vuelo, 'normal') // hasta que no aterricen, mandan los del ciclo anterior

    t += CICLO_HERO_MS.normal
    const inicioAlerta = t
    luego(inicioAlerta, () => {
      fase = 'alerta'
      aplicar() // el destello en la placa es el equipo detectando, no el aviso
    })
    verEn(inicioAlerta + vuelo, 'alerta')
    luego(inicioAlerta + vuelo + CICLO_HERO_MS.retardoAviso, () => {
      aviso = true
      aplicar()
    })

    t += CICLO_HERO_MS.alerta
    const finAlerta = t
    luego(finAlerta, () => {
      fase = 'normal'
      aplicar() // la placa deja de destellar; la tarjeta sigue roja hasta que aterrice el verde
    })
    verEn(finAlerta + vuelo, 'normal')

    t += CICLO_HERO_MS.calma
    const inicioEspera = t
    // el corte se declara recién cuando aterriza el último envío: la emisión
    // para una duración de vuelo antes, así ninguno se apaga a mitad de camino
    luego(Math.max(0, inicioEspera - vuelo), dejarDeEmitir)
    luego(inicioEspera, () => {
      fase = 'espera'
    })
    verEn(inicioEspera, 'espera')
    const sube = CICLO_HERO_MS.espera / cuantas
    for (let i = 1; i <= cuantas; i++) {
      const n = i
      luego(inicioEspera + sube * (i - 1), () => {
        cola = n
        aplicar()
      })
    }

    t += CICLO_HERO_MS.espera
    const inicioDescarga = t
    luego(inicioDescarga, () => {
      fase = 'descarga'
      emitir()
    })
    verEn(inicioDescarga + vueloRapido, 'descarga')
    const baja = (CICLO_HERO_MS.descarga * 0.8) / cuantas
    for (let i = 1; i <= cuantas; i++) {
      const queda = cuantas - i
      luego(inicioDescarga + baja * i, () => {
        cola = queda
        aplicar()
      })
    }

    t += CICLO_HERO_MS.descarga
    const finDescarga = t
    luego(finDescarga, () => {
      fase = 'normal'
    })
    // lo último del buffer todavía viaja rápido: se reinicia cuando aterriza
    verEn(finDescarga + vueloRapido, 'normal')
    luego(finDescarga + vueloRapido, cicloHero)
  }

  if (quieto) {
    // Estado final congelado: cero timers, el mismo que usa la verificación
    // manual (screenshot con reduced-motion) del plan de la landing.
    aplicar()
  } else {
    let corriendo = false

    function iniciar() {
      if (corriendo) return
      corriendo = true
      cicloHero()
    }

    function detener() {
      corriendo = false
      limpiarHeroTimers()
      limpiarSalidas()
    }

    let interseca = !('IntersectionObserver' in window)
    const actualizar = () => {
      if (interseca && !document.hidden) iniciar()
      else detener()
    }

    if (seccion && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => {
          interseca = e.isIntersecting
          actualizar()
        })
      })
      io.observe(seccion)
    } else {
      actualizar()
    }

    document.addEventListener('visibilitychange', actualizar)
  }
}
