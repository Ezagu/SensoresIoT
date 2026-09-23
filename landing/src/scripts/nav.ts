// Fuente: Main.dc.html tMenu/cerrarMenu/menuCls (~línea 755). `client:load`
// equivalente: está sobre el fold y un tap sin respuesta ahí se nota.
const boton = document.getElementById('btn-menu') as HTMLButtonElement | null
const panel = document.getElementById('menu-secciones') as HTMLElement | null

if (boton && panel) {
  const cerrar = () => {
    boton.setAttribute('aria-expanded', 'false')
    boton.setAttribute('aria-label', 'Abrir el menú')
    panel.classList.remove('abierto')
    panel.inert = true
  }

  const abrir = () => {
    boton.setAttribute('aria-expanded', 'true')
    boton.setAttribute('aria-label', 'Cerrar el menú')
    panel.classList.add('abierto')
    panel.inert = false
  }

  boton.addEventListener('click', () => {
    if (boton.getAttribute('aria-expanded') === 'true') cerrar()
    else abrir()
  })

  panel.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) cerrar()
  })

  // Escape cierra y devuelve el foco al botón: sin esto el teclado queda
  // adentro del panel sin salida declarada.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') {
      cerrar()
      boton.focus()
    }
  })

  // Al pasar a desktop el menú de mano no debe quedar abierto ni inert=false
  const mq = matchMedia('(max-width: 720px)')
  const alCambiar = (e: MediaQueryListEvent | MediaQueryList) => {
    if (!e.matches) cerrar()
  }
  mq.addEventListener('change', alCambiar)
}

export {}
