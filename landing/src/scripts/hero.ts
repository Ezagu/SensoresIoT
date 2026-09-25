// La demo en vivo del celular del hero: entra una lectura cada PASO_MS, el
// trazo se corre y cada lectura pasa por el mismo evaluador que el backend.
// Corre sólo con el hero en pantalla y la pestaña visible; al volver sigue
// desde donde quedó.
import { CANALES, CANAL_MS, MUESTRA_INICIAL, PASO_MS, UMBRAL, evaluadorHasta, trazoEn, valorDe } from '../datos/hero'

const tel = document.getElementById('tel')
const aviso = document.getElementById('tel-aviso')
const valor = document.getElementById('tel-valor')
const trazoAbajo = document.getElementById('tel-trazo-abajo')
const trazoArriba = document.getElementById('tel-trazo-arriba')
const punta = document.getElementById('tel-punta')
const pastillaNormal = document.getElementById('tel-normal')
const pastillaAlerta = document.getElementById('tel-alerta')
const seccion = document.getElementById('top')

if (tel && aviso && valor && trazoAbajo && trazoArriba && punta && pastillaNormal && pastillaAlerta && seccion
  && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const fmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const evaluador = evaluadorHasta(MUESTRA_INICIAL)

  let muestra = MUESTRA_INICIAL
  let ultimaEvaluada = MUESTRA_INICIAL
  let origen = 0
  let cuadro = 0
  let rotacion: number | null = null
  let corriendo = false

  function rotarCanales() {
    let i = 0
    aviso!.dataset.canal = CANALES[i]
    rotacion = window.setInterval(() => {
      i = (i + 1) % CANALES.length
      aviso!.dataset.canal = CANALES[i]
    }, CANAL_MS)
  }

  function frenarCanales() {
    if (rotacion !== null) clearInterval(rotacion)
    rotacion = null
  }

  function aplicarEstado() {
    const alerta = evaluador.estado === 'alerta'
    tel!.classList.toggle('es-alerta', alerta)
    pastillaNormal!.hidden = alerta
    pastillaAlerta!.hidden = !alerta
    aviso!.classList.toggle('on', alerta)
    frenarCanales()
    if (alerta) rotarCanales()
  }

  function dibujar() {
    const { puntos, punta: [x, y] } = trazoEn(muestra)
    trazoAbajo!.setAttribute('points', puntos)
    trazoArriba!.setAttribute('points', puntos)
    punta!.setAttribute('cx', String(x))
    punta!.setAttribute('cy', String(y))
    punta!.classList.toggle('arriba', valorDe(Math.floor(muestra)) > UMBRAL)
  }

  function paso(ahora: number) {
    muestra = MUESTRA_INICIAL + (ahora - origen) / PASO_MS
    while (ultimaEvaluada < Math.floor(muestra)) {
      ultimaEvaluada++
      const v = valorDe(ultimaEvaluada)
      valor!.textContent = fmt.format(v)
      if (evaluador.evaluar(v)) aplicarEstado()
    }
    dibujar()
    cuadro = requestAnimationFrame(paso)
  }

  function iniciar() {
    if (corriendo) return
    corriendo = true
    origen = performance.now() - (muestra - MUESTRA_INICIAL) * PASO_MS
    if (evaluador.estado === 'alerta' && rotacion === null) rotarCanales()
    cuadro = requestAnimationFrame(paso)
  }

  function detener() {
    corriendo = false
    cancelAnimationFrame(cuadro)
    frenarCanales()
  }

  let interseca = !('IntersectionObserver' in window)
  const actualizar = () => (interseca && !document.hidden ? iniciar() : detener())

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entradas) => {
      entradas.forEach((e) => { interseca = e.isIntersecting })
      actualizar()
    }).observe(seccion)
  }
  actualizar()
  document.addEventListener('visibilitychange', actualizar)
}
