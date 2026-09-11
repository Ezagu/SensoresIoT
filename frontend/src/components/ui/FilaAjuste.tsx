import type { ReactNode } from 'react'

/* Los ids los arma la fila y los consume el control: un <button role="switch">
   no se asocia a un <label>, así que su nombre accesible tiene que apuntar al
   título visible. */
export const idsDeFila = (id: string) => ({ etiqueta: `${id}-t`, descripcion: `${id}-d` })

/* Renglón de una lista de ajustes: qué es, qué implica, y el control a la
   derecha. Dentro de un contenedor con `divide-y divide-border`. */
export function FilaAjuste({
  id,
  titulo,
  descripcion,
  children,
}: {
  id: string
  titulo: string
  descripcion?: ReactNode
  children: ReactNode
}) {
  const ids = idsDeFila(id)

  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p id={ids.etiqueta} className="text-label-lg font-medium text-text">
          {titulo}
        </p>
        {descripcion && (
          <p id={ids.descripcion} className="mt-0.5 max-w-96 text-note text-text-faint">
            {descripcion}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center pt-0.5">{children}</div>
    </div>
  )
}
