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
