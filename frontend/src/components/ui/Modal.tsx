import { useEffect, useRef, type ReactNode } from 'react'
import { IconoCerrar } from '@/components/layout/iconos'

/* <dialog> nativo: focus trap, Escape y ::backdrop vienen del navegador. */
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
      /* Sin `max-h` un formulario más alto que la ventana se corta sin forma de
         llegar al botón. No se usa flex: `display:flex` de autor le gana al
         `display:none` que el navegador aplica al <dialog> cerrado. */
      className="m-auto max-h-[92dvh] w-[min(92vw,420px)] overflow-y-auto overscroll-contain rounded-card border border-border bg-surface p-0 text-text shadow-lg backdrop:bg-overlay"
    >
      <div className="sticky top-0 z-1 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
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
