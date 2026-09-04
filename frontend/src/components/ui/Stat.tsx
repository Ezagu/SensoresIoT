type Tamano = 'sm' | 'md'

const CLASES: Record<Tamano, { padding: string; etiqueta: string; valor: string }> = {
  sm: { padding: 'px-2.5 py-1.5', etiqueta: 'text-tag', valor: 'text-heading-lg' },
  md: { padding: 'px-3.5 py-2', etiqueta: 'text-note', valor: 'text-metric' },
}

export function Stat({
  etiqueta,
  valor,
  tamano = 'sm',
}: {
  etiqueta: string
  valor: string
  tamano?: Tamano
}) {
  const clases = CLASES[tamano]
  return (
    <span className={`flex flex-1 flex-col gap-0.5 ${clases.padding}`}>
      <span className={`uppercase tracking-wide text-text-faint ${clases.etiqueta}`}>{etiqueta}</span>
      <span className={`num font-semibold text-text leading-tight ${clases.valor}`}>{valor}</span>
    </span>
  )
}
