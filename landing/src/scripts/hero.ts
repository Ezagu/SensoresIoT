// Fuente: Main.dc.html — cicloHero()/contar()/reiniciarHero() (~línea 1736)
// y el tramo "hero" de renderVals() (~línea 2085). Traducción 1:1 salvo:
// - se gatea con IntersectionObserver + visibilitychange (el mockup corría
//   los timers para siempre, con el hero fuera de pantalla o en background);
// - riseCls/heroIn desaparecen (ver estilos/hero.css, animation con delay);
// - sin data-props: los tiempos y textos son los defaults de datos/config.ts
//   y datos/textos.ts.
import { TEXTOS_ESTADO, type FaseHero } from '../datos/textos'
import { CICLO_HERO_MS, COLA_MAX } from '../datos/config'

const svg = document.getElementById('hero-svg')
const ledHalo = document.getElementById('hero-led-halo')
const ledDot = document.getElementById('hero-led-dot')
const bufs = [1, 2, 3, 4].map((n) => document.getElementById(`buf-${n}`))
const estadoCard = document.getElementById('estado-card')
const estadoTitulo = document.getElementById('estado-titulo')
const estadoSub = document.getElementById('estado-sub')
const estadoAvisa = document.getElementById('estado-avisa')
const heroTempEl = document.getElementById('hero-temp')
const heroDesdeEl = document.getElementById('hero-desde')
const seccion = document.getElementById('top')

if (svg && ledHalo && ledDot && estadoCard && estadoTitulo && estadoSub && estadoAvisa && heroTempEl && heroDesdeEl) {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches

  let fase: FaseHero = 'normal'
  let cola = 0
  let aviso = false
  let heroTemp = 0
  let swap = 0
  let heroTimers: number[] = []
  let contarTimer: number | null = null

  const coma = (n: number) => n.toFixed(1).replace('.', ',')

  function aplicar() {
    const transmitiendo = fase !== 'espera'
    const descarga = fase === 'descarga'
    svg!.setAttribute(
      'class',
      ['device', 'hero-dev', 'rise', `f-${fase}`, transmitiendo ? 'tx' : '', descarga ? 'tx-rapido' : '']
        .filter(Boolean)
        .join(' '),
    )
    const color = fase === 'alerta' ? 'var(--lp-warn-mark)' : fase === 'espera' ? 'var(--lp-amber)' : 'var(--lp-ok)'
    ledHalo!.setAttribute('fill', color)
    ledDot!.setAttribute('fill', color)

    bufs.forEach((el, i) => el?.classList.toggle('on', cola > i))

    const tipo = fase === 'alerta' ? 'is-alerta' : fase === 'espera' || fase === 'descarga' ? 'is-espera' : 'is-normal'
    estadoCard!.setAttribute('class', `estado-card ${tipo} ${swap % 2 === 0 ? 'sw-a' : 'sw-b'}`)
    if (fase === 'alerta') estadoCard!.setAttribute('role', 'status')
    else estadoCard!.removeAttribute('role')

    const textos = TEXTOS_ESTADO[fase]
    estadoTitulo!.textContent = textos.titulo
    estadoSub!.textContent = textos.sub
    estadoAvisa!.hidden = !(fase === 'alerta' && aviso)

    heroTempEl!.textContent = fase === 'alerta' ? '8,9' : coma(heroTemp)
    heroDesdeEl!.textContent =
      fase === 'alerta' ? 'fuera de rango' : fase === 'espera' ? 'guardando para enviar' : 'última lectura hace 4 s'
    svg!.setAttribute(
      'aria-label',
      fase === 'alerta'
        ? 'El equipo detecta una medición fuera de rango y la transmite por wi-fi'
        : fase === 'espera'
          ? 'Las mediciones llegan al equipo y quedan en cola hasta poder transmitirse'
          : 'Las mediciones viajan de los sensores al equipo y salen por la antena wi-fi',
    )
  }

  function contar(destino: number, dur: number) {
    const inicio = Date.now()
    const paso = () => {
      const t = Math.min(1, (Date.now() - inicio) / dur)
      const suave = 1 - Math.pow(1 - t, 3)
      heroTemp = Math.round(destino * suave * 10) / 10
      aplicar()
      if (t < 1) contarTimer = window.setTimeout(paso, 45)
    }
    paso()
  }

  function limpiarHeroTimers() {
    heroTimers.forEach(clearTimeout)
    heroTimers = []
  }

  function cicloHero() {
    limpiarHeroTimers()
    const luego = (t: number, fn: () => void) => heroTimers.push(window.setTimeout(fn, t))
    const cuantas = COLA_MAX
    let t = 0

    fase = 'normal'
    cola = 0
    aviso = false
    swap++
    aplicar()

    t += CICLO_HERO_MS.normal
    const inicioEspera = t
    luego(inicioEspera, () => {
      fase = 'espera'
      swap++
      aplicar()
    })
    const sube = CICLO_HERO_MS.espera / (cuantas + 1)
    for (let i = 1; i <= cuantas; i++) {
      const n = i
      luego(inicioEspera + sube * i, () => {
        cola = n
        aplicar()
      })
    }

    t += CICLO_HERO_MS.espera
    const inicioDescarga = t
    luego(inicioDescarga, () => {
      fase = 'descarga'
      swap++
      aplicar()
    })
    const baja = (CICLO_HERO_MS.descarga * 0.8) / cuantas
    for (let i = 1; i <= cuantas; i++) {
      const queda = cuantas - i
      luego(inicioDescarga + baja * i, () => {
        cola = queda
        aplicar()
      })
    }

    t += CICLO_HERO_MS.descarga
    luego(t, () => {
      fase = 'normal'
      swap++
      aplicar()
    })

    t += CICLO_HERO_MS.calma
    const inicioAlerta = t
    luego(inicioAlerta, () => {
      fase = 'alerta'
      swap++
      aplicar()
    })
    luego(inicioAlerta + CICLO_HERO_MS.retardoAviso, () => {
      aviso = true
      aplicar()
    })

    t += CICLO_HERO_MS.alerta
    luego(t, cicloHero)
  }

  if (quieto) {
    // Estado final congelado: cero timers, el mismo que usa la verificación
    // manual (screenshot con reduced-motion) del plan de la landing.
    heroTemp = 4.2
    aplicar()
  } else {
    let corriendo = false
    let contado = false

    function iniciar() {
      if (corriendo) return
      corriendo = true
      if (!contado) {
        contado = true
        contar(4.2, 900)
      }
      cicloHero()
    }

    function detener() {
      corriendo = false
      limpiarHeroTimers()
      if (contarTimer) clearTimeout(contarTimer)
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
