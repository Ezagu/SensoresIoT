import { useRef, type KeyboardEvent } from 'react'

export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta,
  fueraDelPlan,
}: {
  valor: T | null
  opciones: { valor: T; etiqueta: string }[]
  onCambiar: (valor: T) => void
  etiqueta: string
  /* Opción que excede el plan del dueño: se pinta violeta pero se elige igual,
     y quien la consume explica después qué parte quedó afuera. Marcar sin
     bloquear, no al revés: el candado deja al usuario sin ver nunca su propio
     límite. Sin esta prop no hay marca, que es lo que necesitan los otros
     consumidores (tema, filas por página). */
  fueraDelPlan?: (valor: T) => boolean
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
      /* Envuelve en vez de desbordar: siete rangos miden ~400px y en un celular
         de 360px las últimas opciones quedaban fuera de pantalla o arrastraban
         scroll horizontal a la página entera. */
      className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-group border border-border bg-surface-2 p-1"
    >
      {opciones.map((o, indice) => {
        const excede = fueraDelPlan?.(o.valor) ?? false
        return (
          <button
            key={o.valor}
            ref={(nodo) => {
              botones.current[indice] = nodo
            }}
            type="button"
            role="radio"
            aria-checked={o.valor === valor}
            aria-label={excede ? `${o.etiqueta} — tu plan no cubre todo este rango` : undefined}
            title={excede ? 'Tu plan no cubre todo este rango: vas a ver la parte disponible' : undefined}
            tabIndex={indice === conFoco ? 0 : -1}
            onKeyDown={(evento) => alTeclado(evento, indice)}
            onClick={() => onCambiar(o.valor)}
            /* 44px con el dedo (pointer-coarse), 32px con mouse: la densidad de
               escritorio no tiene por qué pagar el tamaño de toque. */
            className={`flex min-h-8 items-center gap-1 rounded-tile px-3 text-label font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer pointer-coarse:min-h-11 ${
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
