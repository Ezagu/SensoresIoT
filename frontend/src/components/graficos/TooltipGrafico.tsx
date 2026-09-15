import type { PuntoGrilla } from '@/utils/series'
import { medida } from '@/utils/formato'
import { fechaHora } from '@/utils/tiempo'

export function TooltipGrafico({
  active,
  payload,
  unidad,
}: {
  active?: boolean
  payload?: { payload: PuntoGrilla }[]
  unidad: string
}) {
  if (!active || !payload?.length) return null
  const punto = payload[0].payload
  if (punto.valor === null) return null
  return (
    <div className="rounded-control border border-border bg-elevated px-2.5 py-1.5 text-note-lg shadow-overlay">
      <p className="num text-text-faint">{fechaHora(new Date(punto.t).toISOString())}</p>
      <p className="num font-semibold text-text">{medida(punto.valor, unidad)}</p>
    </div>
  )
}
