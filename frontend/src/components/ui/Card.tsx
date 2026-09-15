import type { HTMLAttributes, ReactNode } from 'react'

type Tono = 'surface' | 'warn'

type Props = HTMLAttributes<HTMLDivElement> & { tono?: Tono; children: ReactNode }

/* El fondo va por prop: una clase de fondo desde afuera compite con la de acá y
   gana el orden del stylesheet, no el del atributo.
   Sin sombra: el contenedor se apoya en el borde hairline y nada más. La
   jerarquía la hacen las reglas, el espacio y el peso tipográfico. */
const FONDOS: Record<Tono, string> = {
  surface: 'bg-surface',
  warn: 'bg-warn-soft',
}

export function Card({ tono = 'surface', className = '', children, ...props }: Props) {
  return (
    <div
      className={`${FONDOS[tono]} border border-border rounded-card ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
