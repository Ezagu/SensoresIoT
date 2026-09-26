import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { Boton } from '@/components/ui/Boton'
import { IconoGoogle } from '@/components/ui/IconoGoogle'
import { IconoChevron } from '@/components/layout/iconos'
import { Logo } from '@/components/layout/Logo'

/* Formulario centrado, sin ilustración: sólo la marca arriba a la izquierda. */
export function MarcoAuth({
  titulo,
  subtitulo,
  volver,
  encabezado,
  children,
}: {
  titulo: string
  subtitulo?: ReactNode
  /* Link chico arriba del título, para salir de un flujo secundario. */
  volver?: { a: string; etiqueta: string }
  /* Ícono o marca arriba del título. */
  encabezado?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-6 md:px-12 md:pt-10">
        <Link to="/" aria-label="Bitácora, inicio">
          <Logo />
        </Link>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-10">
        <div className="w-full max-w-110 rounded-2xl border border-border-control bg-surface p-6 shadow-modal md:p-10">
          {volver && (
            <Link
              to={volver.a}
              className="mb-6 inline-flex items-center gap-2 text-body text-text-muted hover:text-text"
            >
              <IconoChevron className="size-3.5 rotate-180" />
              {volver.etiqueta}
            </Link>
          )}
          {encabezado && <div className="mb-6">{encabezado}</div>}
          <h1 className="text-page">{titulo}</h1>
          {subtitulo && (
            <div className="mt-3 text-body-lg leading-relaxed text-text-muted">{subtitulo}</div>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  )
}

/* PENDIENTE (OAuth diferido en CLAUDE.md): el botón está a la vista pero no
   hace nada todavía. */
export function ContinuarConGoogle() {
  return (
    <>
      <div className="my-6 flex items-center gap-4 text-note text-text-faint">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>
      <Boton variante="sutil" disabled className="w-full" title="Pendiente de backend">
        <IconoGoogle />
        Continuar con Google
      </Boton>
      <div className="mt-3">
        <AvisoPendiente>ingresar con Google todavía no está en el backend.</AvisoPendiente>
      </div>
    </>
  )
}

export function PieAuth({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-center text-body-lg text-text-muted">{children}</p>
}
