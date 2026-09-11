import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variante = 'primario' | 'sutil' | 'fantasma' | 'texto' | 'destructivo'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  children: ReactNode
}

/* pointer-coarse sube el alto: 36 alcanza con un mouse, no con un dedo. Las de
   pantalla van a 44; las de fila (texto/destructivo) a 40, porque vienen de a
   tres en un grupo con separación propia y son transparentes: a 44 el label de
   11px queda nadando en un bloque vacío, que es justo lo que ensucia el mobile. */
const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-control font-semibold whitespace-nowrap cursor-pointer ' +
  'transition-[filter,background-color,color] duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-accent-strong text-accent-ink text-label-lg min-h-9 px-3.5 pointer-coarse:min-h-11 shadow-sm hover:brightness-110 active:translate-y-px',
  sutil:
    'bg-accent-soft text-accent text-note-lg min-h-9 px-3.5 pointer-coarse:min-h-11 hover:bg-border',
  fantasma:
    'bg-transparent text-text-muted text-label-lg min-h-9 px-3 pointer-coarse:min-h-11 border border-border hover:text-text hover:border-border-strong',
  /* Acciones dentro de una fila de lista: pesan menos que un botón de pantalla. */
  texto: 'bg-transparent text-text-muted text-note min-h-8 px-2 pointer-coarse:min-h-10 hover:bg-surface-2 hover:text-text',
  /* Se pinta de rojo recién con el puntero o el foco: en reposo, la más llamativa
     de la fila sería la más fácil de apretar sin querer. */
  destructivo:
    'bg-transparent text-text-muted text-note min-h-8 px-2 pointer-coarse:min-h-10 hover:bg-danger-soft hover:text-danger focus-visible:text-danger',
}

export function Boton({ variante = 'primario', className = '', children, ...props }: Props) {
  return (
    <button className={`${BASE} ${VARIANTES[variante]} ${className}`} {...props}>
      {children}
    </button>
  )
}

/* Mismas clases que Boton, sobre <Link>: navegar a una ruta no puede ser un
   <button> envuelto en <a>, que es HTML inválido y rompe el foco por teclado. */
type PropsLink = LinkProps & { variante?: Variante; children: ReactNode }

export function BotonLink({ variante = 'primario', className = '', children, ...props }: PropsLink) {
  return (
    <Link className={`${BASE} ${VARIANTES[variante]} ${className}`} {...props}>
      {children}
    </Link>
  )
}
