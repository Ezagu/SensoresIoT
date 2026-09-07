import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

/* Ritmo compartido por las seis secciones: título, una línea que explica la
   consecuencia (no el control en sí), el contenido, y un pie opcional para la
   acción de guardado. Evita repetirlo seis veces. */
export function SeccionAjustes({
  titulo,
  descripcion,
  accion,
  children,
  pie,
}: {
  titulo: string
  descripcion?: ReactNode
  /* Elemento a la derecha del título (ej: un Pill de "Solo lectura"). */
  accion?: ReactNode
  children?: ReactNode
  pie?: ReactNode
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading font-semibold">{titulo}</h2>
        {accion}
      </div>
      {descripcion && <p className="-mt-2 text-label text-text-faint">{descripcion}</p>}
      {children}
      {pie && <div className="mt-1 flex flex-wrap items-center justify-end gap-3">{pie}</div>}
    </Card>
  )
}
