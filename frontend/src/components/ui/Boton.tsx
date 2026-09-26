import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variante = 'primario' | 'sutil' | 'fantasma' | 'texto' | 'destructivo'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  children: ReactNode
}

/* Dos de las tres alturas del sistema: 40 para los botones de pantalla, 28 para
   los de fila. El borde transparente está siempre puesto, así una variante con
   borde y una sin él no se corren un píxel cuando conviven en la misma barra.
   Deshabilitado tiene relleno y texto propios: nunca opacidad sobre el activo. */
const BASE =
  'inline-flex items-center justify-center rounded-control border font-medium whitespace-nowrap ' +
  'cursor-pointer transition-colors duration-130 disabled:cursor-not-allowed disabled:border-border ' +
  'disabled:bg-surface-inert disabled:text-disabled-text disabled:hover:border-border ' +
  'disabled:hover:bg-surface-inert disabled:hover:text-disabled-text'

const MEDIA = 'h-10 gap-2 px-4 text-body-lg'
const FILA = 'h-7 gap-1.5 px-2.5 text-body'

const VARIANTES: Record<Variante, string> = {
  primario: `${MEDIA} border-transparent bg-accent-strong text-accent-ink hover:bg-accent-strong-hover active:bg-accent-strong-active`,
  /* La alternativa a la acción principal: lleva marco, no color de marca. */
  sutil: `${MEDIA} border-border-control bg-transparent text-text hover:border-accent-border active:bg-border`,
  /* Barra de herramientas: sin marco, para no competir con la acción principal. */
  fantasma: `${MEDIA} border-transparent bg-transparent text-text-muted hover:bg-surface-2 hover:text-text active:bg-border`,
  /* Acciones dentro de una fila de lista: pesan menos que un botón de pantalla. */
  texto: `${FILA} border-transparent bg-transparent text-text-muted hover:bg-surface-2 hover:text-text active:bg-border`,
  /* Se pinta de rojo recién con el puntero o el foco: en reposo, la más llamativa
     de la fila sería la más fácil de apretar sin querer. */
  destructivo: `${FILA} border-transparent bg-transparent text-text-muted hover:bg-danger-soft hover:text-danger focus-visible:text-danger`,
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
