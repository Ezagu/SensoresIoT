import { Stat } from './Stat'
import { medida } from '@/lib/formato'

type Resumen = { promedio: number | null; minimo: number | null; maximo: number | null }

export function ResumenStats({
  resumen,
  unidad,
  tamano = 'sm',
  gap = 'gap-3',
}: {
  resumen: Resumen
  unidad: string
  tamano?: 'sm' | 'md'
  gap?: string
}) {
  return (
    <div className={`flex ${gap}`}>
      <Stat tamano={tamano} etiqueta="prom" valor={resumen.promedio !== null ? medida(resumen.promedio, unidad) : '—'} />
      <Stat tamano={tamano} etiqueta="mín" valor={resumen.minimo !== null ? medida(resumen.minimo, unidad) : '—'} />
      <Stat tamano={tamano} etiqueta="máx" valor={resumen.maximo !== null ? medida(resumen.maximo, unidad) : '—'} />
    </div>
  )
}
