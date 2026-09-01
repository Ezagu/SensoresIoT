import { useCallback, useEffect, useState } from 'react'

export type Tema = 'sistema' | 'claro' | 'oscuro'

const CLAVE = 'bitacora-tema'

function aplicar(tema: Tema) {
  const root = document.documentElement
  if (tema === 'sistema') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', tema === 'claro' ? 'light' : 'dark')
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

  useEffect(() => {
    aplicar(tema)
    try {
      localStorage.setItem(CLAVE, tema)
    } catch {
      /* la preferencia no persiste, pero la sesión actual igual la respeta */
    }
  }, [tema])

  return { tema, cambiarTema: useCallback((t: Tema) => setTema(t), []) }
}

/* Se aplica antes del primer render para no pintar un flash del tema opuesto */
export function aplicarTemaGuardado() {
  aplicar(guardado())
}
