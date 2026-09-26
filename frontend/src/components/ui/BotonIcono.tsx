import type { ComponentPropsWithRef, ReactNode } from 'react'

type Variante = 'fantasma' | 'marco'
type Tamano = 'sm' | 'md' | 'lg'

type Props = ComponentPropsWithRef<'button'> & {
  etiqueta: string
  variante?: Variante
  tamano?: Tamano
  children: ReactNode
}

const TAMANOS: Record<Tamano, string> = { sm: 'size-7', md: 'size-8.5', lg: 'size-10' }

const VARIANTES: Record<Variante, string> = {
  fantasma: 'border-transparent bg-transparent',
  marco: 'border-border-control bg-transparent hover:border-accent-border',
}

const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control border text-text-muted ' +
  'transition-colors duration-130 hover:bg-surface-2 hover:text-text active:bg-border ' +
  'aria-pressed:bg-accent-soft aria-pressed:text-accent disabled:cursor-not-allowed ' +
  'disabled:bg-surface-inert disabled:text-disabled-text disabled:hover:bg-surface-inert'

/* Cuadrado, una sola acción, sin texto en pantalla: por eso `etiqueta` es
   obligatoria — es lo único que lo nombra para un lector de pantalla. */
export function BotonIcono({
  etiqueta,
  variante = 'fantasma',
  tamano = 'md',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={`${BASE} ${TAMANOS[tamano]} ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
