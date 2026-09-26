import type { ReactNode } from 'react'

/* Los ids los arma la fila y los consume el control: un <button role="switch">
   no se asocia a un <label>, así que su nombre accesible tiene que apuntar al
   título visible. */
export const idsDeFila = (id: string) => ({ etiqueta: `${id}-t`, descripcion: `${id}-d` })

/* Renglón de ajustes: qué es a la izquierda, el valor o el control al medio, y
   la acción sobre ese renglón a la derecha. Angosto, todo se apila.
   `para` asocia el título a un campo como <label>. */
export function FilaAjuste({
  id,
  titulo,
  descripcion,
  opcional = false,
  para,
  accion,
  children,
}: {
  id: string
  titulo: string
  descripcion?: ReactNode
  opcional?: boolean
  para?: string
  accion?: ReactNode
  children?: ReactNode
}) {
  const ids = idsDeFila(id)
  const Titulo = para ? 'label' : 'p'

  return (
    <div className="grid gap-x-6 gap-y-2 border-b border-border py-3 last:border-b-0 md:grid-cols-[13.75rem_minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <Titulo id={ids.etiqueta} htmlFor={para} className="block text-body-lg text-text-muted">
          {titulo}
        </Titulo>
        {opcional && <span className="block text-note text-text-faint">opcional</span>}
        {descripcion && (
          <p id={ids.descripcion} className="mt-0.5 max-w-80 text-note text-text-faint">
            {descripcion}
          </p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
      {accion && <div className="flex items-center gap-3 md:justify-end">{accion}</div>}
    </div>
  )
}

/* El valor de un renglón que no se edita acá: dato principal y un detalle chico. */
export function ValorAjuste({ children, detalle }: { children: ReactNode; detalle?: ReactNode }) {
  return (
    <p className="text-body-lg text-text">
      {children}
      {detalle && <span className="text-note text-text-faint"> · {detalle}</span>}
    </p>
  )
}
