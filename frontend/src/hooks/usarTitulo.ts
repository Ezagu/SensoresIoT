import { createContext, useContext, useEffect } from 'react'

export const MARCA = 'Bitácora'

/* Por contexto y no escribiendo `document.title` desde la pantalla: los efectos
   corren de hijo a padre y el Layout pisaría lo que la pantalla puso. */
export const ContextoTitulo = createContext<(titulo: string | null) => void>(() => {})

export function useTituloPagina(titulo: string | null) {
  const anunciar = useContext(ContextoTitulo)
  useEffect(() => {
    if (titulo === null) return
    anunciar(titulo)
    // Al desmontar vuelve a mandar el título de la sección.
    return () => anunciar(null)
  }, [anunciar, titulo])
}
