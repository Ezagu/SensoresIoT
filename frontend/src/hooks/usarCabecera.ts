import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const MARCA = 'Bitácora'

export type Miga = { etiqueta: string; a?: string }

export type Ranuras = { meta: HTMLElement | null; acciones: HTMLElement | null }

/* Dos contextos y no uno: el rastro se publica desde un efecto, así que si
   compartiera identidad con las ranuras (que cambian cuando el Layout monta sus
   nodos) el efecto se volvería a disparar y se anunciaría de nuevo. */
export const ContextoRastro = createContext<(migas: Miga[] | null) => void>(() => {})
export const ContextoRanuras = createContext<Ranuras>({ meta: null, acciones: null })

/* La pantalla publica su rastro y el Layout lo pinta: los efectos corren de
   hijo a padre, así que si cada pantalla escribiera el título el Layout se lo
   pisaría al montar. La última miga es el título; las anteriores, la ruta. */
export function useRastro(migas: Miga[] | null) {
  const anunciar = useContext(ContextoRastro)
  const llave = migas ? JSON.stringify(migas) : null

  useEffect(() => {
    if (llave === null) return
    anunciar(JSON.parse(llave) as Miga[])
    return () => anunciar(null)
  }, [anunciar, llave])
}

/* Por portal y no por contexto: lo que va en la cabecera es JSX de la pantalla y
   cambia de identidad en cada render, así que guardarlo en estado del Layout
   sería un ciclo. */
function enRanura(nodo: HTMLElement | null, children: ReactNode) {
  return nodo ? createPortal(children, nodo) : null
}

/* Cuán fresco es lo que se está mirando. */
export function MetaCabecera({ children }: { children: ReactNode }) {
  return enRanura(useContext(ContextoRanuras).meta, children)
}

/* Lo que se puede hacer con la pantalla entera, no con una de sus fichas. */
export function AccionesCabecera({ children }: { children: ReactNode }) {
  return enRanura(useContext(ContextoRanuras).acciones, children)
}
