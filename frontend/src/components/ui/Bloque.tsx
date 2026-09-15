import type { ReactNode } from 'react'

/* Contenedor con marco, sólo cuando el grupo existe de verdad: un bloque con
   título propio y, a veces, acciones propias. Sin sombra — la jerarquía la
   hacen el hairline, el espacio y el peso tipográfico.
   `sinPadding` para listas y tablas que tienen que llegar al borde. */
export function Bloque({
  titulo,
  subtitulo,
  acciones,
  sinPadding = false,
  className = '',
  children,
}: {
  titulo?: ReactNode
  subtitulo?: ReactNode
  acciones?: ReactNode
  sinPadding?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <section className={`overflow-hidden rounded-card border border-border bg-surface ${className}`}>
      {(titulo || acciones) && (
        <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 flex-col">
            {titulo && <h2 className="truncate text-body font-semibold text-text">{titulo}</h2>}
            {subtitulo && <p className="truncate text-note-lg text-text-muted">{subtitulo}</p>}
          </div>
          {acciones && <div className="ml-auto flex shrink-0 items-center gap-2">{acciones}</div>}
        </header>
      )}
      <div className={sinPadding ? '' : 'p-5'}>{children}</div>
    </section>
  )
}
