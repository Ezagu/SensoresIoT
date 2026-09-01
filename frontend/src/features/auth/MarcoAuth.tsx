import type { ReactNode } from 'react'
import { Logo } from '@/components/layout/Logo'

export { Campo, CampoPassword } from '@/components/ui/Campo'

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
      <div className="w-full max-w-95">
        <div className="mb-6">
          <Logo />
        </div>

        <h1 className="text-hero mb-1">{titulo}</h1>
        {subtitulo && <p className="mt-1 mb-5 text-label-lg text-text-muted">{subtitulo}</p>}

        <div className="rounded-card border border-border bg-surface p-5 shadow-sm">{children}</div>
      </div>
    </div>
  )
}
