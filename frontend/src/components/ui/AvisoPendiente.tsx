import type { ReactNode } from 'react'

/* Marca de UI armada sin backend todavía: no se sale a producción con uno de
   estos a la vista. Buscar `AvisoPendiente` da la lista de lo que falta. */
export function AvisoPendiente({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="rounded-group border border-attention-border bg-attention-soft px-3.5 py-2.5 text-body text-attention"
    >
      <b className="font-semibold">Pendiente:</b> {children}
    </p>
  )
}
