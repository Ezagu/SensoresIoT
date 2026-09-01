export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta,
}: {
  valor: T
  opciones: { valor: T; etiqueta: string }[]
  onCambiar: (valor: T) => void
  etiqueta: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex shrink-0 rounded-group border border-border bg-surface-2 p-0.5"
    >
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => onCambiar(o.valor)}
          className={`min-h-8 rounded-tile px-3 text-label font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer ${
            o.valor === valor
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}
