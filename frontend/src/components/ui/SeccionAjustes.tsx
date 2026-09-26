import type { ReactNode } from 'react'

/* Ritmo compartido por las secciones de ajustes (las del equipo y las de la
   cuenta): una regla arriba, el título, una línea opcional que explica la
   consecuencia (no el control en sí) y los renglones. Sin tarjeta: la regla y
   el espacio separan. */
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
  titulo: ReactNode
  descripcion?: ReactNode
  /* Elemento a la derecha del título (ej: un Pill de "Solo lectura"). */
  accion?: ReactNode
  children?: ReactNode
  pie?: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border-control pt-9 pb-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading-lg">{titulo}</h2>
        {accion}
      </div>
      {descripcion && <p className="mt-1.5 max-w-150 text-body text-text-muted">{descripcion}</p>}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
      {pie && <div className="mt-3 flex flex-wrap items-center justify-end gap-3">{pie}</div>}
    </section>
  )
}

/* Lo que no se deshace: desvincular un equipo, eliminar la cuenta. Caja con
   borde rojo al final de la página, fuera del ritmo de las secciones. */
export function ZonaPeligro({
  id,
  titulo,
  children,
  accion,
}: {
  id?: string
  titulo: string
  children: ReactNode
  accion: ReactNode
}) {
  return (
    <section
      id={id}
      className="mt-8 flex scroll-mt-20 flex-col gap-4 rounded-card border border-danger-border px-6 py-6 md:flex-row md:items-center md:justify-between"
    >
      <div className="max-w-110">
        <h2 className="text-heading font-semibold">{titulo}</h2>
        <div className="mt-1 text-body leading-relaxed text-text-muted">{children}</div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">{accion}</div>
    </section>
  )
}
