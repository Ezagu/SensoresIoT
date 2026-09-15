import type { ReactNode } from 'react'
import { IconoAlerta, IconoProblema, IconoReloj } from '@/components/layout/iconos'

type Tono = 'info' | 'atencion' | 'advertencia' | 'critico'

const MARCA: Record<Tono, { Icono: typeof IconoAlerta; color: string }> = {
  info: { Icono: IconoAlerta, color: 'text-accent' },
  atencion: { Icono: IconoReloj, color: 'text-attention-mark' },
  advertencia: { Icono: IconoProblema, color: 'text-warn-mark' },
  critico: { Icono: IconoProblema, color: 'text-danger-mark' },
}

const FONDO: Record<Tono, string> = {
  info: 'bg-accent-soft border-accent-border',
  atencion: 'bg-attention-soft border-attention-border',
  advertencia: 'bg-warn-soft border-warn-border',
  critico: 'bg-danger-soft border-danger-border',
}

/* Mensaje en línea sobre el estado de la pantalla. Se llama Banner y no Alert
   porque "alerta" en este producto es una regla de umbral, que es otra cosa. */
export function Banner({
  tono,
  titulo,
  acciones,
  children,
}: {
  tono: Tono
  titulo?: string
  acciones?: ReactNode
  children?: ReactNode
}) {
  const { Icono, color } = MARCA[tono]
  return (
    <div
      role={tono === 'critico' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-control border p-3.5 ${FONDO[tono]}`}
    >
      <Icono className={`mt-px size-4 shrink-0 ${color}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {titulo && <p className="text-body-lg font-medium text-text">{titulo}</p>}
        {children && <div className="text-body text-text-muted">{children}</div>}
        {acciones && <div className="mt-2 flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </div>
  )
}
