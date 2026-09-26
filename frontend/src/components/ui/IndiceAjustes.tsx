import { useEffect, useRef, useState } from 'react'

export type Seccion = { id: string; etiqueta: string }

/* La sección activa es la que ocupa la franja de arriba de la ventana, recortada
   con rootMargin: la de abajo del header pegajoso hasta el primer tercio. Entre
   dos secciones no hay ninguna en la franja, y ahí se conserva la última. */
function useSeccionVisible(secciones: Seccion[]) {
  const [activa, setActiva] = useState(secciones[0]?.id ?? '')
  const visibles = useRef(new Set<string>())

  useEffect(() => {
    const nodos = secciones
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => n !== null)
    if (nodos.length === 0) return

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) visibles.current.add(entrada.target.id)
          else visibles.current.delete(entrada.target.id)
        }
        const primera = secciones.find((s) => visibles.current.has(s.id))
        if (primera) setActiva(primera.id)
      },
      { rootMargin: '-80px 0px -66% 0px' },
    )

    nodos.forEach((nodo) => observador.observe(nodo))
    return () => observador.disconnect()
  }, [secciones])

  return activa
}

/* Índice lateral, sólo donde sobra ancho. Abajo de xl las cuatro secciones
   entran en dos pantallas de scroll y un índice sería un renglón de más entre
   el título y lo que se vino a cambiar. */
export function IndiceAjustes({
  secciones,
  peligro,
}: {
  secciones: Seccion[]
  /* La acción irreversible de la página, aparte y en rojo: lleva a su caja. */
  peligro?: Seccion
}) {
  const activa = useSeccionVisible(secciones)

  return (
    <nav aria-label="Secciones de ajustes" className="hidden xl:block xl:w-45 xl:shrink-0">
      <ul className="sticky top-24 flex flex-col gap-0.5">
        {secciones.map(({ id, etiqueta }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={activa === id ? 'true' : undefined}
              className={`block rounded-tile px-3 py-2 text-body transition-colors duration-150 ${
                activa === id
                  ? 'bg-surface-2 text-text'
                  : 'text-text-muted hover:bg-border hover:text-text'
              }`}
            >
              {etiqueta}
            </a>
          </li>
        ))}
        {peligro && (
          <li className="mt-4">
            <a
              href={`#${peligro.id}`}
              className="block rounded-tile border border-danger-border px-3 py-2 text-body text-danger transition-colors duration-150 hover:bg-danger-soft"
            >
              {peligro.etiqueta}
            </a>
          </li>
        )}
      </ul>
    </nav>
  )
}
