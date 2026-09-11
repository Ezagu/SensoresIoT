/* Encendido/apagado de una sola preferencia. Distinto de <Segmentado>, que
   nombra sus dos estados: acá el estado lo dice la posición del pulgar y el
   texto de la fila, así que una lista de preferencias no repite "Activadas /
   Silenciadas" en cada renglón. */
export function Interruptor({
  activo,
  onCambiar,
  etiquetaId,
  descripcionId,
  disabled,
}: {
  activo: boolean
  onCambiar: (activo: boolean) => void
  /* El nombre accesible es el título visible de la fila, no una copia suya. */
  etiquetaId: string
  descripcionId?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-labelledby={etiquetaId}
      aria-describedby={descripcionId}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      /* El pseudo-elemento lleva el área de toque a 44px sin agrandar el dibujo;
         cabe dentro del padding de la fila, así que no le roba el click a la de
         al lado. */
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors duration-150 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] disabled:cursor-not-allowed disabled:opacity-50 ${
        activo
          ? 'border-accent-strong bg-accent-strong'
          : 'border-border bg-surface-2 hover:border-border-strong'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-4 rounded-full transition-transform duration-150 ${
          activo ? 'translate-x-4 bg-accent-ink' : 'translate-x-0 bg-text-muted'
        }`}
      />
    </button>
  )
}
