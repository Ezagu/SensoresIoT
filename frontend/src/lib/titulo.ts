import { createContext, useContext, useEffect } from 'react'

export const MARCA = 'Bitácora'

/* Título de pestaña más específico que el de la sección. Va por contexto y no
   escribiendo `document.title` desde la pantalla, porque los efectos corren de
   hijo a padre: el Layout pisaría lo que la pantalla acaba de poner. */
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
