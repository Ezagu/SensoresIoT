import { IconoBuscar, IconoCerrar } from '@/components/layout/iconos'

/* Sin <Campo>: esa etiqueta siempre visible rompe una barra de controles
   compacta. Filtra al tipear, sin submit. */
export function CampoBusqueda({
  valor,
  onCambiar,
  placeholder,
  className = '',
}: {
  valor: string
  onCambiar: (valor: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <IconoBuscar className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-faint" />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={placeholder}
        className="h-8.5 w-full rounded-control border border-border-control bg-surface pr-8.5 pl-8 text-body-lg text-text transition-colors duration-130 placeholder:text-text-faint hover:border-border-strong focus-visible:border-accent"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onCambiar('')}
          aria-label="Limpiar búsqueda"
          className="absolute inset-y-0 right-0 flex w-8.5 items-center justify-center text-text-muted transition-colors duration-130 hover:text-text"
        >
          <IconoCerrar className="size-3.5" />
        </button>
      )}
    </div>
  )
}
