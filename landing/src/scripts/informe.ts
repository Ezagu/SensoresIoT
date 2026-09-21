// Fuente: Main.dc.html — generarInforme() (~línea 2178). `client:idle`
// equivalente: el botón está muy abajo de la página, nadie lo toca en el
// primer segundo.
type Estado = 'vacio' | 'generando' | 'listo'

const boton = document.getElementById('btn-informe')
const vacio = document.getElementById('informe-vacio')
const generando = document.getElementById('informe-generando')
const progreso = document.getElementById('informe-progreso')
const hoja = document.getElementById('informe-hoja')
const paso = document.getElementById('paso-documenta')

if (boton && vacio && generando && progreso && hoja && paso) {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
  let estado: Estado = 'vacio'

  function aplicar() {
    vacio!.hidden = estado !== 'vacio'
    generando!.hidden = estado !== 'generando'
    progreso!.hidden = estado !== 'generando'
    paso!.classList.toggle('ahora', estado === 'listo')
    boton!.textContent = estado === 'generando' ? 'Generando…' : estado === 'listo' ? 'Generar de nuevo' : 'Generar informe'

    if (estado === 'listo') {
      hoja!.hidden = false
      requestAnimationFrame(() => hoja!.classList.add('listo'))
    } else {
      hoja!.classList.remove('listo')
      hoja!.hidden = true
    }
  }

  boton.addEventListener('click', () => {
    if (estado === 'generando') return
    estado = 'generando'
    aplicar()
    window.setTimeout(
      () => {
        estado = 'listo'
        aplicar()
      },
      quieto ? 0 : 1300,
    )
  })
}

export {}
