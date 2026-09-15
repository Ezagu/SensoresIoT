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
      className="m-auto max-h-[92dvh] w-[min(92vw,460px)] overflow-y-auto overscroll-contain rounded-card border border-border-control bg-elevated p-0 text-text shadow-modal backdrop:bg-overlay"
    >
      {/* La cabecera queda pegajosa —un formulario largo tiene que dejar el
          cierre a mano— y por eso conserva su regla: sin ella el contenido
          pasaría por debajo sin separación. */}
      <div className="sticky top-0 z-1 flex items-center justify-between gap-3 border-b border-border bg-elevated px-5 py-3.5">
        <h2 className="text-page font-semibold">{titulo}</h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex size-8.5 items-center justify-center rounded-control text-text-muted transition-colors duration-130 hover:bg-surface-2 hover:text-text active:bg-border cursor-pointer"
        >
          <IconoCerrar className="size-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}
