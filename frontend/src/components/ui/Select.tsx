import type { ReactNode, SelectHTMLAttributes } from 'react'
import { IconoChevronAbajo } from '@/components/layout/iconos'
import { Etiqueta, Pie, borde, descrito } from '@/components/ui/Campo'

type Tamaño = 'normal' | 'compacto'

/* appearance-none es el punto: el select nativo trae su propio marco cuadrado,
   su flecha pegada al borde y un hover del sistema que ignora la paleta. Con la
   caja apagada, el estilo es el mismo que el de cualquier otro control. */
const BASE =
  'w-full cursor-pointer appearance-none rounded-control border bg-surface-2 font-sans text-text ' +
  'transition-colors duration-150 hover:border-border-strong outline-none ' +
  /* El menú desplegable lo dibuja el sistema: en los navegadores que lo
     permiten, al menos que no aparezca en blanco sobre el tema oscuro. */
  '[&>option]:bg-surface-2 [&>option]:text-text ' +
  'disabled:cursor-not-allowed disabled:bg-surface-inert disabled:text-text-muted disabled:hover:border-border'

const TAMAÑOS: Record<Tamaño, string> = {
  normal: 'min-h-10 pl-3 pr-9 text-body',
  compacto: 'min-h-8 pl-2.5 pr-7.5 text-note pointer-coarse:min-h-11',
}

const CHEVRON: Record<Tamaño, string> = {
  normal: 'right-3 size-4',
  compacto: 'right-2 size-3.5',
}

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string
  etiqueta: string
  etiquetaOculta?: boolean
  ayuda?: string
  error?: string
  /* compacto: filas de lista y barras de controles, a la par de Boton "texto". */
  tamaño?: Tamaño
  children: ReactNode
}

export function Select({
  id,
  etiqueta,
  etiquetaOculta,
  ayuda,
  error,
  tamaño = 'normal',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <Etiqueta id={id} disabled={props.disabled} oculta={etiquetaOculta}>
        {etiqueta}
      </Etiqueta>
      <div className="relative">
        <select
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={descrito(id, error, ayuda)}
          className={`peer ${BASE} ${TAMAÑOS[tamaño]} ${borde(error)} ${className}`}
          {...props}
        >
          {children}
        </select>
        <IconoChevronAbajo
          className={`pointer-events-none absolute inset-y-0 my-auto text-text-muted peer-disabled:text-text-faint ${CHEVRON[tamaño]}`}
        />
      </div>
      <Pie id={id} error={error} ayuda={ayuda} />
    </div>
  )
}
