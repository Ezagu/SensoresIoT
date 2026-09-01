import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'sutil' | 'fantasma'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  children: ReactNode
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-control font-semibold whitespace-nowrap cursor-pointer ' +
  'transition-[filter,background-color,color] duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-accent-strong text-accent-ink text-label-lg min-h-9 px-3.5 shadow-sm hover:brightness-110 active:translate-y-px',
  sutil:
    'bg-accent-soft text-accent text-note-lg min-h-9 px-3.5 hover:bg-border',
  fantasma:
    'bg-transparent text-text-muted text-label-lg min-h-9 px-3 border border-border hover:text-text hover:border-border-strong',
}

export function Boton({ variante = 'primario', className = '', children, ...props }: Props) {
  return (
    <button className={`${BASE} ${VARIANTES[variante]} ${className}`} {...props}>
      {children}
    </button>
  )
}
