import { medida } from '@/utils/formato'

type Tamano = 'sm' | 'md'

const CLASES: Record<Tamano, { padding: string; etiqueta: string; valor: string }> = {
  sm: { padding: 'px-2 py-1.5', etiqueta: 'text-tag', valor: 'text-heading-lg' },
  md: { padding: 'px-3.5 py-2', etiqueta: 'text-note', valor: 'text-metric' },
}

type Resumen = { promedio: number | null; minimo: number | null; maximo: number | null }

export function ResumenStats({
  resumen,
  unidad,
  tamano = 'sm',
  className = '',
}: {
  resumen: Resumen
  unidad: string
  tamano?: Tamano
  className?: string
}) {
  const clases = CLASES[tamano]
  const stats = [
    { etiqueta: 'prom', valor: resumen.promedio },
    { etiqueta: 'mín', valor: resumen.minimo },
    { etiqueta: 'máx', valor: resumen.maximo },
  ]

  return (
    <div
      className={`flex min-w-0 divide-x divide-border overflow-hidden rounded-control border border-border bg-surface-2 ${className}`}
    >
      {stats.map(({ etiqueta, valor }) => (
        /* min-w-0: una presión de 1.015,8 hPa tiene ancho mínimo de sobra para
           empujar la tarjeta y, con ella, el ancho de la página entera. */
        <span key={etiqueta} className={`flex flex-1 flex-col gap-0.5 ${clases.padding}`}>
          <span className={`uppercase tracking-wide text-text-faint ${clases.etiqueta}`}>{etiqueta}</span>
          <span className={`num font-semibold text-text leading-tight ${clases.valor}`}>
            {valor !== null ? medida(valor, unidad) : '—'}
          </span>
        </span>
      ))}
    </div>
  )
}
