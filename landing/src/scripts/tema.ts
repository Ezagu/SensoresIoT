// El stamp pre-paint vive en Base.astro (is:inline). Esto maneja el selector
// del pie. Mismo contrato que frontend/src/hooks/usarTema.ts: clave
// 'bitacora-tema', valores 'sistema'|'claro'|'oscuro'.
type Tema = 'sistema' | 'claro' | 'oscuro'
const CLAVE = 'bitacora-tema'
const sistemaClaro = matchMedia('(prefers-color-scheme: light)')

function leer(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    if (t === 'claro' || t === 'oscuro') return t
  } catch {
    /* storage bloqueado: sigue al sistema */
  }
  return 'sistema'
}

function guardar(tema: Tema) {
  try {
    if (tema === 'sistema') localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, tema)
  } catch {
    /* modo privado: la sesión igual respeta el cambio */
  }
}

const botones = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tema]'))
let actual = leer()

function aplicar() {
  const claro = actual === 'claro' || (actual === 'sistema' && sistemaClaro.matches)
  document.documentElement.dataset.theme = claro ? 'light' : 'dark'
  botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tema === actual)))
}

botones.forEach((b) => {
  b.addEventListener('click', () => {
    actual = b.dataset.tema as Tema
    guardar(actual)
    aplicar()
  })
})
sistemaClaro.addEventListener('change', () => {
  if (actual === 'sistema') aplicar()
})
aplicar()

export {}
