import type { ReactNode } from 'react'

/* Contenedor con marco, sólo cuando el grupo existe de verdad: un bloque con
   título propio y, a veces, acciones propias. Sin sombra — la jerarquía la
   hacen el hairline, el espacio y el peso tipográfico.
   `sinPadding` para listas y tablas que tienen que llegar al borde. */
/* `destacado` es para el bloque que ES la pantalla (el gráfico del detalle de
   sensor), no para uno más de una pila. */
export function Bloque({
  titulo,
  subtitulo,
  acciones,
  destacado = false,
  sinPadding = false,
  className = '',
  children,
}: {
  titulo?: ReactNode
  subtitulo?: ReactNode
  acciones?: ReactNode
  destacado?: boolean
  sinPadding?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <section className={`overflow-hidden rounded-card border border-border bg-surface ${className}`}>
      {/* La cabecera envuelve en vez de empujar: en un ancho chico el subtítulo
          dice algo que la barra de la app ya no está mostrando. */}
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 flex-col gap-1">
            {/* Sin truncate: el título puede traer una unidad o una pastilla al
                lado, y recortarlos es peor que dejarlos pasar a otro renglón. */}
            {titulo && (
              <h2
                className={`font-semibold text-text ${destacado ? 'font-display text-heading-lg' : 'text-body'}`}
              >
                {titulo}
              </h2>
            )}
            {subtitulo && <p className="truncate text-note-lg text-text-muted">{subtitulo}</p>}
          </div>
          {/* Envuelto ocupa su propio renglón desde la izquierda: empujado a la
              derecha deja sin lugar a lo que cuelgue de él. */}
          {acciones && (
            <div className="flex w-full shrink-0 items-center gap-0.5 sm:ml-auto sm:w-auto">{acciones}</div>
          )}
        </header>
      )}
      <div className={sinPadding ? '' : 'p-5'}>{children}</div>
    </section>
  )
}
