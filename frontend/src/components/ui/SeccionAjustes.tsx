import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

/* Ritmo compartido por las secciones de ajustes (las del equipo y las de la
   cuenta): título, una línea que explica la consecuencia (no el control en sí),
   el contenido, y un pie opcional para la acción de guardado. */
export function SeccionAjustes({
  id,
  titulo,
  descripcion,
  accion,
  children,
  pie,
}: {
  /* Ancla del índice lateral. El margen de scroll descuenta la barra pegajosa,
     que si no tapa el título al saltar. */
  id?: string
  titulo: string
  descripcion?: ReactNode
  /* Elemento a la derecha del título (ej: un Pill de "Solo lectura"). */
  accion?: ReactNode
  children?: ReactNode
  pie?: ReactNode
}) {
  return (
    <Card id={id} className="flex scroll-mt-20 flex-col gap-3 p-4">
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
