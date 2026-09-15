import type { ReactNode } from 'react'
import { Lectura } from '@/components/ui/Lectura'

type Tono = 'normal' | 'atencion' | 'advertencia' | 'critico'

/* Rótulo + valor para una tira de resumen: sin caja propia, porque la caja la
   pone la tira con sus reglas. El pie es el contexto que hace legible la cifra
   (cuándo, sobre cuántas, desde dónde). */
export function Metrica({
  etiqueta,
  valor,
  unidad = '',
  tono = 'normal',
  apagado = false,
  pie,
}: {
  etiqueta: string
  valor: number | null
  unidad?: string
  tono?: Tono
  apagado?: boolean
  pie?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-tag font-semibold tracking-micro text-text-muted uppercase">
        {etiqueta}
      </span>
      <Lectura valor={valor} unidad={unidad} tamano="md" tono={tono} apagado={apagado} />
      {pie && <span className="truncate text-note-lg text-text-muted">{pie}</span>}
    </div>
  )
}

/* Se adapta sola a cuántas métricas le pongan adentro: ninguna pantalla puede
   asumir un kit fijo de sensores, y por lo tanto tampoco de cifras. */
export function TiraMetricas({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-x-8 gap-y-6 border-y border-border py-5 sm:flex sm:justify-around">
      {children}
    </div>
  )
}
