import type { ReactNode } from 'react'

/* Un vacío dice qué pasó y qué hacer, en voz de la interfaz. */
export function Vacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string
  detalle?: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
      <p className="text-text-muted font-medium">{titulo}</p>
      {detalle && <p className="text-label text-text-faint max-w-[46ch]">{detalle}</p>}
      {accion && <div className="mt-1">{accion}</div>}
    </div>
  )
}
