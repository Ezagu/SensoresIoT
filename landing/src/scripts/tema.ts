// El stamp pre-paint vive en Base.astro (is:inline). Esto sólo maneja el
// toggle: lee el estado que ya escribió el stamp y lo invierte. Mismo
// contrato que frontend/src/hooks/usarTema.ts — clave 'bitacora-tema',
// pero la landing sólo escribe 'claro'/'oscuro', nunca 'sistema'.
const CLAVE = 'bitacora-tema'

function guardar(valor: 'claro' | 'oscuro') {
  try {
    localStorage.setItem(CLAVE, valor)
  } catch {
    /* modo privado o storage bloqueado: la sesión igual respeta el cambio */
  }
}

function aplicar(oscuro: boolean, boton: HTMLButtonElement) {
  document.documentElement.dataset.theme = oscuro ? 'dark' : 'light'
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  boton.setAttribute('aria-pressed', String(oscuro))
  boton.setAttribute('aria-label', etiqueta)
  boton.title = etiqueta
}

const boton = document.getElementById('btn-tema') as HTMLButtonElement | null
if (boton) {
  aplicar(document.documentElement.dataset.theme !== 'light', boton)
  boton.addEventListener('click', () => {
    const oscuroAhora = document.documentElement.dataset.theme !== 'light'
    aplicar(!oscuroAhora, boton)
    guardar(oscuroAhora ? 'claro' : 'oscuro')
  })
}

export {}
