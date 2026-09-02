export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta,
  bloqueada,
  onBloqueada,
}: {
  valor: T
  opciones: { valor: T; etiqueta: string }[]
  onCambiar: (valor: T) => void
  etiqueta: string
  /* Opción visible pero fuera del plan del dueño: se pinta violeta y no se
     puede elegir — el click no llama a onCambiar, dispara onBloqueada (la app
     lo usa para mandar a /plan). Sin esta prop el comportamiento es el de
     siempre, así que los otros consumidores (tema, filas por página) no la
     necesitan. */
  bloqueada?: (valor: T) => boolean
  onBloqueada?: (valor: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex shrink-0 rounded-group border border-border bg-surface-2 p-0.5"
    >
      {opciones.map((o) => {
        const esBloqueada = bloqueada?.(o.valor) ?? false
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={!esBloqueada && o.valor === valor}
            aria-label={esBloqueada ? `${o.etiqueta} — función premium, ver planes` : undefined}
            title={esBloqueada ? 'Es una función premium — ver planes' : undefined}
            onClick={() => (esBloqueada ? onBloqueada?.(o.valor) : onCambiar(o.valor))}
            className={`flex min-h-8 items-center gap-1 rounded-tile px-3 text-label font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer ${
              esBloqueada
                ? 'text-premium hover:bg-premium-soft'
                : o.valor === valor
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
            }`}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
