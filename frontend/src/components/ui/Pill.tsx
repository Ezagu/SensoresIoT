type Tono = 'ok' | 'warn' | 'danger' | 'faint' | 'premium'

const TONOS: Record<Tono, string> = {
  ok: 'bg-ok-soft border-ok-border text-ok',
  warn: 'bg-warn-soft border-warn-border text-warn',
  danger: 'bg-danger-soft border-danger-border text-danger',
  faint: 'bg-surface-2 border-border text-text-muted',
  premium: 'bg-accent-soft border-accent-border text-accent',
}

/* Etiqueta corta pegada a otro elemento: un rol, un plan, una condición de la
   fila. Para el estado de un equipo o de un sensor va PastillaEstado, que lleva
   glifo con forma propia: acá el color no codifica estado, sólo acompaña. */
export function Pill({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-chip border px-1.75 text-tag font-semibold tracking-wide whitespace-nowrap uppercase ${TONOS[tono]}`}
    >
      {children}
    </span>
  )
}

/* Un número pegado a un nombre: cuántas reglas están sonando en ese equipo.
   Relleno sólido porque es lo único de la fila que tiene que contarse de lejos.
   La tinta es el fondo de la página y no blanco: en oscuro el rojo del sistema
   es un tono claro —está hecho para texto— y blanco encima no tendría contraste. */
export function PillConteo({ children }: { children: React.ReactNode }) {
  return (
    <span className="num inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-chip bg-danger px-1.5 text-note-lg text-bg">
      {children}
    </span>
  )
}
