import type { EstadoDispositivo } from '@/utils/tiempo'

type Tono = 'ok' | 'warn' | 'danger' | 'faint' | 'premium'

const TONOS: Record<Tono, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  faint: 'bg-surface-2 text-text-faint',
  premium: 'bg-accent-soft text-accent',
}

/* El punto refuerza, no reemplaza: el texto del pill es el canal principal
   para no depender del color solo. Geometría de cápsula de estado del sistema:
   22 de alto, más aire a la derecha que a la izquierda porque el glifo ya
   ocupa su propio margen óptico. */
export function Pill({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-5.5 items-center gap-1.75 shrink-0 rounded-full pl-1.75 pr-2.25 text-body font-medium whitespace-nowrap ${TONOS[tono]}`}
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
