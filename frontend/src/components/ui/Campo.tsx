import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { IconoOjo, IconoOjoTachado } from '@/components/layout/iconos'

export const CLASES_INPUT =
  'min-h-10 w-full rounded-control border bg-surface-2 px-3 text-body text-text placeholder:text-text-faint ' +
  /* Deshabilitado: la superficie se hunde a surface-inert para perder el "pozo"
     que hace ver editable a un campo, y el valor baja a text-muted — sigue
     siendo información legible (el intervalo que rige, p. ej.), no un dato
     tachado. Sin opacidad sobre todo el campo: dejaría el valor por debajo del
     contraste mínimo. */
  'disabled:cursor-not-allowed disabled:bg-surface-inert disabled:text-text-muted'

export const borde = (error?: string) =>
  error ? 'border-danger focus-visible:border-danger' : 'border-border focus-visible:border-accent'

/* La etiqueta acompaña el estado del control: deshabilitada baja un escalón
   para que el bloque entero se lea como inactivo, no sólo la caja. */
function Etiqueta({ id, disabled, children }: { id: string; disabled?: boolean; children: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className={`text-label font-medium ${disabled ? 'text-text-faint' : 'text-text-muted'}`}
    >
      {children}
    </label>
  )
}

/* El error reemplaza a la ayuda en vez de sumarse: el campo no cambia de alto
   al fallar, así el formulario no salta bajo el dedo. */
function Pie({ id, error, ayuda }: { id: string; error?: string; ayuda?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-note text-danger">
        {error}
      </p>
    )
  }
  if (ayuda) {
    return (
      <p id={`${id}-ayuda`} className="text-note text-text-faint">
        {ayuda}
      </p>
    )
  }
  return null
}

export function descrito(id: string, error?: string, ayuda?: string) {
  if (error) return `${id}-error`
  if (ayuda) return `${id}-ayuda`
  return undefined
}

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
}

export function Campo({ id, etiqueta, ayuda, error, className = '', ...props }: CampoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Etiqueta id={id} disabled={props.disabled}>
        {etiqueta}
      </Etiqueta>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(id, error, ayuda)}
        className={`${CLASES_INPUT} ${borde(error)} ${className}`}
        {...props}
      />
      <Pie id={id} error={error} ayuda={ayuda} />
    </div>
  )
}

/* Contraseña con alternancia de visibilidad. El botón vive dentro del campo y
   es focusable, así que se llega por teclado sin salir del formulario. */
export function CampoPassword({ id, etiqueta, ayuda, error, className = '', ...props }: CampoProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <Etiqueta id={id} disabled={props.disabled}>
        {etiqueta}
      </Etiqueta>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={descrito(id, error, ayuda)}
          className={`${CLASES_INPUT} pr-10 ${borde(error)} ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-control text-text-muted transition-colors duration-150 hover:text-text disabled:cursor-not-allowed disabled:text-text-faint disabled:hover:text-text-faint"
        >
          {visible ? <IconoOjoTachado className="size-4" /> : <IconoOjo className="size-4" />}
        </button>
      </div>
      <Pie id={id} error={error} ayuda={ayuda} />
    </div>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
  children: ReactNode
}

export function Select({ id, etiqueta, ayuda, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Etiqueta id={id} disabled={props.disabled}>
        {etiqueta}
      </Etiqueta>
      <select
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(id, error, ayuda)}
        className={`${CLASES_INPUT} ${borde(error)} ${className}`}
        {...props}
      >
        {children}
      </select>
      <Pie id={id} error={error} ayuda={ayuda} />
    </div>
  )
}
