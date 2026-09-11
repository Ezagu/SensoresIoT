import { useRef, type CSSProperties, type KeyboardEvent } from 'react'

export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta,
  fueraDelPlan,
  mensajeFueraDelPlan,
  columnasAngosto,
  disabled,
}: {
  valor: T | null
  opciones: { valor: T; etiqueta: string }[]
  onCambiar: (valor: T) => void
  etiqueta: string
  /* Opción que excede el plan del dueño: se marca pero se elige igual, y quien
     la consume explica qué parte quedó afuera. Sin la prop no hay marca. */
  fueraDelPlan?: (valor: T) => boolean
  /* Qué implica esa marca acá: no es lo mismo "vas a ver la parte disponible"
     (un rango) que "tu plan no permite bajar de esto" (un piso). Default =
     caso de rango, el primer consumidor que existió. */
  mensajeFueraDelPlan?: (valor: T) => string
  /* Columnas del grupo mientras la pantalla es angosta. Envolver como texto deja
     sola en su renglón a la última opción cuando una etiqueta es mucho más ancha
     que el resto; en columnas iguales el grupo se lee como una escala, y la
     primera —el modo por defecto, no un valor más de esa escala— se lleva la
     fila entera. */
  columnasAngosto?: number
  disabled?: boolean
}) {
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const seleccionada = opciones.findIndex((o) => o.valor === valor)
  /* Sin selección (una ventana por fechas) el tab entra por la primera opción. */
  const conFoco = seleccionada === -1 ? 0 : seleccionada

  function mover(desde: number, delta: number) {
    if (disabled) return
    const destino = (desde + delta + opciones.length) % opciones.length
    botones.current[destino]?.focus()
    // Las flechas seleccionan, como en cualquier grupo de radios.
    onCambiar(opciones[destino].valor)
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
      style={
        columnasAngosto
          ? ({ '--columnas': `repeat(${columnasAngosto}, minmax(0, 1fr))` } as CSSProperties)
          : undefined
      }
      /* Nunca desborda: o envuelve, o va en columnas iguales. Siete rangos no
         entran en 360px de ninguna manera. */
      className={`gap-0.5 rounded-group border border-border bg-surface-2 p-1 ${
        columnasAngosto
          ? 'grid w-full grid-cols-(--columnas) sm:flex sm:w-fit sm:max-w-full sm:flex-wrap'
          : 'flex w-fit max-w-full flex-wrap'
      }`}
    >
      {opciones.map((o, indice) => {
        const excede = fueraDelPlan?.(o.valor) ?? false
        const mensaje = excede
          ? (mensajeFueraDelPlan?.(o.valor) ?? 'Tu plan no cubre todo este rango: vas a ver la parte disponible')
          : undefined
        return (
          <button
            key={o.valor}
            ref={(nodo) => {
              botones.current[indice] = nodo
            }}
            type="button"
            role="radio"
            aria-checked={o.valor === valor}
            aria-label={mensaje ? `${o.etiqueta} — ${mensaje}` : undefined}
            title={mensaje}
            disabled={disabled}
            tabIndex={indice === conFoco ? 0 : -1}
            onKeyDown={(evento) => alTeclado(evento, indice)}
            onClick={() => !disabled && onCambiar(o.valor)}
            /* 44px con el dedo (pointer-coarse), 32px con mouse: la densidad de
               escritorio no tiene por qué pagar el tamaño de toque. */
            className={`flex min-h-8 items-center justify-center gap-1 rounded-tile text-label font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              columnasAngosto
                ? `px-1.5 sm:px-3 ${indice === 0 ? 'col-span-full sm:col-auto' : ''}`
                : 'px-3'
            } ${
              o.valor === valor
                ? `bg-surface shadow-sm ${excede ? 'text-premium' : 'text-text'}`
                : excede
                  ? 'text-premium hover:bg-premium-soft'
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
