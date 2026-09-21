// Fuente: Main.dc.html — correrGuardia() (~línea 1815) y el tramo "guardia"
// de renderVals() (~línea 2110). `client:visible` equivalente: arranca con
// IntersectionObserver threshold 0.3, igual que el original, y se
// desconecta tras el primer disparo — "Ver otra vez" no reabre el observer.
type FaseGuardia = 'calma' | 'sube' | 'alerta'

const seccion = document.getElementById('guardia')
const titulo = document.getElementById('watch-titulo')
const valor = document.getElementById('watch-valor')
const nota = document.getElementById('watch-nota')
const pillNormal = document.getElementById('pastilla-normal')
const pillCritical = document.getElementById('pastilla-critical')
const btnReplay = document.getElementById('btn-replay')

if (seccion && titulo && valor && nota && pillNormal && pillCritical && btnReplay) {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
  let timers: number[] = []

  function aplicar(fase: FaseGuardia) {
    const enAlerta = fase === 'alerta'
    seccion!.classList.toggle('is-alerta', enAlerta)
    seccion!.classList.toggle('is-sube', fase === 'sube')

    titulo!.textContent = enAlerta ? 'Cuando pasa algo, te enterás.' : 'Casi siempre, no pasa nada.'
    valor!.textContent = enAlerta ? '8,9' : fase === 'sube' ? '7,1' : '4,8'
    nota!.textContent = enAlerta
      ? 'Cruzó el umbral que definiste y salió el aviso. No tuviste que estar mirando.'
      : 'El equipo mide cada 15 a 20 segundos. Mientras el valor esté donde tiene que estar, acá no pasa nada.'
    pillNormal!.hidden = enAlerta
    pillCritical!.hidden = !enAlerta
  }

  function correr() {
    timers.forEach(clearTimeout)
    timers = []
    aplicar('calma')
    if (quieto) {
      aplicar('alerta')
      return
    }
    timers.push(window.setTimeout(() => aplicar('sube'), 700))
    timers.push(window.setTimeout(() => aplicar('alerta'), 2400))
  }

  btnReplay.addEventListener('click', () => {
    if (!quieto) correr()
  })

  if (quieto) {
    aplicar('alerta')
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            correr()
            io.disconnect()
          }
        })
      },
      { threshold: 0.3 },
    )
    io.observe(seccion)
  } else {
    correr()
  }
}

export {}
