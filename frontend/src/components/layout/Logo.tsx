/* La marca es tipografía, no un dibujo: el tick de acento a la izquierda es la
   única pieza gráfica del sistema. Vive acá porque aparece tanto en la sidebar
   como en el marco de auth. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-1.75 font-display text-brand font-semibold tracking-brand text-text">
      <span aria-hidden="true" className="h-3.5 w-0.75 shrink-0 rounded-xs bg-accent-strong" />
      Bitácora
    </span>
  )
}
