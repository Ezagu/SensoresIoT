import { useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { IconoOjo, IconoOjoTachado } from '@/components/layout/iconos'

/* Sin alto: lo pone cada control, porque el <textarea> crece y el <input> no.
   Dos clases de alto en el mismo elemento no se resuelven por orden de atributo,
   se resuelven por orden de hoja de estilos. */
const CLASES_INPUT =
  'w-full rounded-control border bg-surface px-2.5 text-body-lg text-text placeholder:text-text-faint ' +
  'transition-colors duration-130 ' +
  /* Deshabilitado pierde el fondo pero el valor sigue legible con text-muted y no
     con disabled-text: es un dato que hay que poder leer, no un rótulo apagado. */
  'disabled:cursor-not-allowed disabled:bg-surface-inert disabled:text-text-muted'

/* El hover sólo en el estado normal: un campo con error ya eligió su borde y
   teñirlo de gris al pasar por encima lo desmarca justo cuando hay que mirarlo. */
export const borde = (error?: string) =>
  error
    ? 'border-danger-mark focus-visible:border-danger-mark'
    : 'border-border-control hover:border-border-strong focus-visible:border-accent'

/* La altura media del sistema (34px), compartida por Campo y Select. */
export const ALTO_CAMPO = 'h-8.5'

/* La etiqueta acompaña el estado del control: deshabilitada baja un escalón
   para que el bloque entero se lea como inactivo, no sólo la caja. */
export function Etiqueta({
  id,
  disabled,
  oculta,
  children,
}: {
  id: string
  disabled?: boolean
  /* Sigue asociada por htmlFor pero no ocupa lugar: para controles que viven
     en una barra o en una fila de lista, donde el rótulo ya lo da el contexto. */
  oculta?: boolean
  children: ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className={
        oculta ? 'sr-only' : `text-label font-medium ${disabled ? 'text-text-faint' : 'text-text-muted'}`
      }
    >
      {children}
    </label>
  )
}

/* El error reemplaza a la ayuda en vez de sumarse: el campo no cambia de alto
   al fallar, así el formulario no salta bajo el dedo. */
export function Pie({ id, error, ayuda }: { id: string; error?: string; ayuda?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-note-lg text-danger">
        {error}
      </p>
    )
  }
  if (ayuda) {
    return (
      <p id={`${id}-ayuda`} className="text-note-lg text-text-faint">
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
        className={`${CLASES_INPUT} ${ALTO_CAMPO} ${borde(error)} ${className}`}
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
          className={`${CLASES_INPUT} ${ALTO_CAMPO} pr-8.5 ${borde(error)} ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-8.5 items-center justify-center rounded-r-control text-text-muted transition-colors duration-130 hover:text-text disabled:cursor-not-allowed disabled:text-disabled-text disabled:hover:text-disabled-text"
        >
          {visible ? <IconoOjoTachado className="size-4" /> : <IconoOjo className="size-4" />}
        </button>
      </div>
      <Pie id={id} error={error} ayuda={ayuda} />
    </div>
  )
}

type AreaTextoProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
}

export function AreaTexto({ id, etiqueta, ayuda, error, className = '', ...props }: AreaTextoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Etiqueta id={id} disabled={props.disabled}>
        {etiqueta}
      </Etiqueta>
      <textarea
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(id, error, ayuda)}
        className={`${CLASES_INPUT} min-h-22 resize-y py-2 ${borde(error)} ${className}`}
        {...props}
      />
      <Pie id={id} error={error} ayuda={ayuda} />
    </div>
  )
}
