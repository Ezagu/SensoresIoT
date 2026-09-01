import { useEffect, useRef, type ReactNode } from 'react'
import { IconoCerrar } from '@/components/layout/iconos'

/* Sobre <dialog> nativo: focus trap, Escape y backdrop (::backdrop) vienen
   gratis del navegador, mismo criterio que ya usa Layout con `inert` en vez de
   un focus trap a mano. */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onCancel={onCerrar}
      onClick={(e) => {
        // Click en el ::backdrop: el <dialog> ocupa toda la ventana, así que un
        // click fuera del contenido cae directo sobre el elemento raíz.
        if (e.target === ref.current) onCerrar()
      }}
      className="m-auto w-[min(92vw,420px)] rounded-card border border-border bg-surface p-0 text-text shadow-lg backdrop:bg-overlay"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-heading font-semibold">{titulo}</h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex size-7 items-center justify-center rounded-control text-text-muted hover:text-text cursor-pointer"
        >
          <IconoCerrar className="size-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  )
}
