import { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from '@/hooks/usarMedios'

export type Tema = 'sistema' | 'claro' | 'oscuro'

const CLAVE = 'bitacora-tema'
const CLARO_DEL_SISTEMA = '(prefers-color-scheme: light)'

/* data-theme siempre con un tema concreto: el CSS define la paleta clara en un
   solo lugar. El stamp previo al primer paint lo hace el script de index.html. */
function aplicar(tema: Tema, claroDelSistema: boolean) {
  const claro = tema === 'claro' || (tema === 'sistema' && claroDelSistema)
  document.documentElement.dataset.theme = claro ? 'light' : 'dark'
}

function guardado(): Tema {
  try {
    const v = localStorage.getItem(CLAVE)
    if (v === 'claro' || v === 'oscuro' || v === 'sistema') return v
  } catch {
    /* modo privado o storage bloqueado: se cae a "sistema" */
  }
  return 'sistema'
}

/* El menú de cuenta y Ajustes montan el hook a la vez: el cambio en uno tiene
   que llegar al otro. */
const EVENTO = 'bitacora-tema'

export function useTema() {
  const [tema, setTema] = useState<Tema>(guardado)
  /* Con "sistema" el seguimiento del SO ya no lo hace el CSS, hay que leerlo */
  const claroDelSistema = useMediaQuery(CLARO_DEL_SISTEMA)

  useEffect(() => {
    aplicar(tema, claroDelSistema)
  }, [tema, claroDelSistema])

  useEffect(() => {
    const alCambiar = (e: Event) => setTema((e as CustomEvent<Tema>).detail)
    window.addEventListener(EVENTO, alCambiar)
    return () => window.removeEventListener(EVENTO, alCambiar)
  }, [])

  const cambiarTema = useCallback((t: Tema) => {
    try {
      localStorage.setItem(CLAVE, t)
    } catch {
      /* la preferencia no persiste, pero la sesión actual igual la respeta */
    }
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: t }))
  }, [])

  return { tema, cambiarTema }
}
