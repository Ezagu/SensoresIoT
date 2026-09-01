import type { InputHTMLAttributes, ReactNode } from 'react'

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

        <h1 className="text-[22px]">{titulo}</h1>
        {subtitulo && <p className="mt-1 mb-5 text-[12.5px] text-text-muted">{subtitulo}</p>}

        <div className="rounded-[12px] border border-border bg-surface p-5 shadow-sm">{children}</div>
      </div>
    </div>
  )
}

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  etiqueta: string
  ayuda?: string
}

export function Campo({ id, etiqueta, ayuda, className = '', ...props }: CampoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-text-muted">
        {etiqueta}
      </label>
      <input
        id={id}
        name={id}
        className={`min-h-10 rounded-[8px] border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-text-faint focus-visible:border-accent ${className}`}
        {...props}
      />
      {ayuda && <p className="text-[11px] text-text-faint">{ayuda}</p>}
    </div>
  )
}
