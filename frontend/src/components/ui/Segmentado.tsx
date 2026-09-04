import { useRef, type KeyboardEvent } from 'react'

export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta,
  bloqueada,
  onBloqueada,
}: {
  valor: T | null
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
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const seleccionada = opciones.findIndex((o) => o.valor === valor)
  /* Un radiogroup expone un solo punto de entrada al tab y se recorre con las
     flechas. Sin selección (una ventana por fechas, por ejemplo) entra por la
     primera opción. */
  const conFoco = seleccionada === -1 ? 0 : seleccionada

  function mover(desde: number, delta: number) {
    const destino = (desde + delta + opciones.length) % opciones.length
    botones.current[destino]?.focus()
    /* Las flechas seleccionan, como en cualquier grupo de radios — salvo en una
       opción fuera del plan: ahí sólo mueven el foco, porque elegirla dispara
       la navegación a /plan y nadie quiere eso por rozar una tecla. */
    const opcion = opciones[destino]
    if (!(bloqueada?.(opcion.valor) ?? false)) onCambiar(opcion.valor)
  }

  function alTeclado(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const salto =
      evento.key === 'ArrowRight' || evento.key === 'ArrowDown'
        ? 1
        : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp'
          ? -1
          : evento.key === 'Home'
            ? -indice
            : evento.key === 'End'
              ? opciones.length - 1 - indice
              : null
    if (salto === null) return
    evento.preventDefault()
    mover(indice, salto)
  }

  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex shrink-0 rounded-group border border-border bg-surface-2 p-0.5"
    >
      {opciones.map((o, indice) => {
        const esBloqueada = bloqueada?.(o.valor) ?? false
        return (
          <button
            key={o.valor}
            ref={(nodo) => {
              botones.current[indice] = nodo
            }}
            type="button"
            role="radio"
            aria-checked={!esBloqueada && o.valor === valor}
            aria-label={esBloqueada ? `${o.etiqueta} — función premium, ver planes` : undefined}
            title={esBloqueada ? 'Es una función premium — ver planes' : undefined}
            tabIndex={indice === conFoco ? 0 : -1}
            onKeyDown={(evento) => alTeclado(evento, indice)}
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
