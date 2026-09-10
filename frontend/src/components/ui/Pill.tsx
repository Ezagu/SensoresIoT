import type { EstadoDispositivo } from '@/utils/tiempo'

type Tono = 'ok' | 'warn' | 'danger' | 'faint'

const TONOS: Record<Tono, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  faint: 'bg-surface-2 text-text-faint',
}

/* El punto refuerza, no reemplaza: el texto del pill es el canal principal
   para no depender del color solo. */
export function Pill({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.75 text-tag font-semibold whitespace-nowrap ${TONOS[tono]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}

export const TONO_POR_ESTADO: Record<EstadoDispositivo, Tono> = {
  nunca: 'faint',
  'en-linea': 'ok',
  'sin-reportar': 'danger',
}
