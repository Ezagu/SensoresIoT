import { useId, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { PastillaEstado } from '@/components/ui/PastillaEstado'
import { IconoChevronAbajo } from '@/components/layout/iconos'
import type { Estado } from '@/components/ui/MarcaEstado'

/* Un grupo de equipos en el mismo estado. La cápsula vive en el encabezado, no
   por renglón — ahí ya la delimita el grupo — mismo criterio que una fila suelta
   en una lista (ver PastillaEstado). El colapso es puramente de presentación:
   `abierta` decide todo, no hay estado propio acá. */
export function SeccionEstado({
  estado,
  etiqueta,
  cantidad,
  abierta,
  onAlternar,
  descripcion,
  children,
}: {
  estado: Estado
  etiqueta: string
  cantidad: number
  abierta: boolean
  onAlternar: () => void
  descripcion?: ReactNode
  children: ReactNode
}) {
  const panelId = useId()

  return (
    <Card>
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={panelId}
        onClick={onAlternar}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-130 hover:bg-surface-2 sm:px-5"
      >
        <PastillaEstado estado={estado} etiqueta={etiqueta} capsula={false} />
        <span className="num text-body text-text-muted">{cantidad}</span>
        <IconoChevronAbajo
          className={`ml-auto size-4 shrink-0 text-text-muted transition-transform duration-130 ${abierta ? 'rotate-180' : ''}`}
        />
      </button>

      <div id={panelId} className="colapso" data-abierto={abierta}>
        <div className="min-h-0 overflow-hidden border-t border-border">
          {descripcion && (
            <p className="px-4 py-2.5 text-note-lg text-text-faint sm:px-5">{descripcion}</p>
          )}
          <ul className="flex flex-col divide-y divide-border">{children}</ul>
        </div>
      </div>
    </Card>
  )
}
