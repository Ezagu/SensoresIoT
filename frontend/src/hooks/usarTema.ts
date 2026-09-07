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

export function useTema() {
  const [tema, setTema] = useState<Tema>(guardado)
  /* Con "sistema" el seguimiento del SO ya no lo hace el CSS, hay que leerlo */
  const claroDelSistema = useMediaQuery(CLARO_DEL_SISTEMA)

  useEffect(() => {
    aplicar(tema, claroDelSistema)
  }, [tema, claroDelSistema])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, tema)
    } catch {
      /* la preferencia no persiste, pero la sesión actual igual la respeta */
    }
  }, [tema])

  return { tema, cambiarTema: useCallback((t: Tema) => setTema(t), []) }
}
