import type { HTMLAttributes, ReactNode } from 'react'

type Tono = 'surface' | 'warn'

type Props = HTMLAttributes<HTMLDivElement> & { tono?: Tono; children: ReactNode }

/* El fondo se elige por prop y no por className: una clase de fondo pasada
   desde afuera compite con la de acá y gana el orden del stylesheet, no el del
   atributo. */
const FONDOS: Record<Tono, string> = {
  surface: 'bg-surface',
  warn: 'bg-warn-soft',
}

export function Card({ tono = 'surface', className = '', children, ...props }: Props) {
  return (
    <div
      className={`${FONDOS[tono]} border border-border rounded-card shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
