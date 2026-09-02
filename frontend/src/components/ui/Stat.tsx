type Tamano = 'sm' | 'md'

const CLASES: Record<Tamano, { etiqueta: string; valor: string }> = {
  sm: { etiqueta: 'text-note-lg text-text-faint', valor: 'text-note-lg font-medium text-text' },
  md: { etiqueta: 'text-note text-text-faint', valor: 'text-heading-lg font-semibold text-text' },
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
    <span className="flex items-baseline gap-1">
      <span className={clases.etiqueta}>{etiqueta}</span>
      <span className={`num ${clases.valor}`}>{valor}</span>
    </span>
  )
}
