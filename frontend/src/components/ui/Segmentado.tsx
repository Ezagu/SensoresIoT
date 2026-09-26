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
  numerico,
}: {
  valor: T | null
  opciones: { valor: T; etiqueta: string }[]
  onCambiar: (valor: T) => void
  etiqueta: string
  /* Las opciones son una cifra medida (duración, cantidad): tipografía de lectura. */
  numerico?: boolean
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
      className={`gap-0.5 rounded-tile border border-border-control p-0.75 ${
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
            className={`flex h-7.5 min-w-10.5 items-center justify-center gap-1.25 rounded-control text-body font-medium whitespace-nowrap transition-colors duration-130 cursor-pointer disabled:cursor-not-allowed disabled:text-disabled-text ${numerico ? 'num' : ''} ${
              columnasAngosto
                ? `px-1.5 sm:px-2.5 ${indice === 0 ? 'col-span-full sm:col-auto' : ''}`
                : 'px-2.5'
            } ${o.valor === valor ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'}`}
          >
            {o.etiqueta}
            {excede && <span aria-hidden="true" className="size-1.25 rounded-full bg-plan-mark" />}
          </button>
        )
      })}
    </div>
  )
}
