import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'sutil' | 'fantasma' | 'texto' | 'destructivo'

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
  /* Acciones dentro de una fila de lista: pesan menos que un botón de pantalla,
     pero siguen siendo del sistema y no clases sueltas. El alto de toque sube
     con el dedo, igual que en Segmentado. */
  texto: 'bg-transparent text-text-muted text-note min-h-8 px-2 pointer-coarse:min-h-11 hover:bg-surface-2 hover:text-text',
  /* La destructiva arranca con el mismo peso que las demás y recién se pinta de
     rojo cuando el puntero o el foco llegan: en reposo, ser la más llamativa de
     la fila la convierte en la más fácil de apretar sin querer. */
  destructivo:
    'bg-transparent text-text-muted text-note min-h-8 px-2 pointer-coarse:min-h-11 hover:bg-danger-soft hover:text-danger focus-visible:text-danger',
}

export function Boton({ variante = 'primario', className = '', children, ...props }: Props) {
  return (
    <button className={`${BASE} ${VARIANTES[variante]} ${className}`} {...props}>
      {children}
    </button>
  )
}
