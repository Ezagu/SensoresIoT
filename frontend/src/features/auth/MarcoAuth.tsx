import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { IconoOjo, IconoOjoTachado } from '@/components/layout/iconos'

export function MarcoAuth({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-accent-strong">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4"
            >
              <path d="M3 17l5-6 4 4 5-8 4 5" />
            </svg>
          </span>
          <span className="font-display text-base font-bold tracking-tight">Bitácora</span>
        </div>

        <h1 className="text-[22px] mb-1">{titulo}</h1>
        {subtitulo && <p className="mt-1 mb-5 text-[12.5px] text-text-muted">{subtitulo}</p>}

        <div className="rounded-[12px] border border-border bg-surface p-5 shadow-sm">{children}</div>
      </div>
    </div>
  )
}

const CLASES_INPUT =
  'min-h-10 w-full rounded-[8px] border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-faint'

const borde = (error?: string) =>
  error ? 'border-danger focus-visible:border-danger' : 'border-border focus-visible:border-accent'

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
}

/* El error reemplaza a la ayuda en vez de sumarse: el campo no cambia de alto
   al fallar, así el formulario no salta bajo el dedo. */
function Pie({ id, error, ayuda }: { id: string; error?: string; ayuda?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-[11px] text-danger">
        {error}
      </p>
    )
  }
  if (ayuda) {
    return (
      <p id={`${id}-ayuda`} className="text-[11px] text-text-faint">
        {ayuda}
      </p>
    )
  }
  return null
}

function descrito(id: string, error?: string, ayuda?: string) {
  if (error) return `${id}-error`
  if (ayuda) return `${id}-ayuda`
  return undefined
}

export function Campo({ id, etiqueta, ayuda, error, className = '', ...props }: CampoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-text-muted">
        {etiqueta}
      </label>
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
      <label htmlFor={id} className="text-[12px] font-medium text-text-muted">
        {etiqueta}
      </label>
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
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[8px] text-text-muted transition-colors duration-150 hover:text-text"
        >
          {visible ? <IconoOjoTachado className="size-4" /> : <IconoOjo className="size-4" />}
        </button>
      </div>
      <Pie id={id} error={error} ayuda={ayuda} />
    </div>
  )
}
