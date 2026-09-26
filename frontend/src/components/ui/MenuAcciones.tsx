import { useEffect, useId, useRef, useState } from 'react'

export type Accion = {
  etiqueta: string
  onElegir: () => void
  peligrosa?: boolean
  disabled?: boolean
}

/* El "···" de una fila: las acciones sobre un objeto de una lista, fuera de la
   vista hasta que se piden. A diferencia de Desplegable, adentro sólo hay
   acciones y elegir una lo cierra. */
export function MenuAcciones({ etiqueta, acciones }: { etiqueta: string; acciones: Accion[] }) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    const alApuntar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('pointerdown', alApuntar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('pointerdown', alApuntar)
    }
  }, [abierto])

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label={etiqueta}
        title={etiqueta}
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((v) => !v)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors duration-130 hover:bg-border hover:text-text"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {abierto && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-20 mt-1 flex w-44 flex-col rounded-menu border border-border-control bg-elevated p-1.5 shadow-overlay"
        >
          {acciones.map((a) => (
            <button
              key={a.etiqueta}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                setAbierto(false)
                a.onElegir()
              }}
              className={`flex h-9 cursor-pointer items-center rounded-tile px-3 text-left text-body transition-colors duration-130 disabled:cursor-not-allowed disabled:text-disabled-text ${
                a.peligrosa
                  ? 'text-danger hover:bg-danger-soft'
                  : 'text-text-muted hover:bg-border hover:text-text'
              }`}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
