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
      <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-faint" />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={placeholder}
        className="min-h-10 w-full rounded-control border border-border bg-surface-2 py-2 pr-9 pl-9 text-body text-text placeholder:text-text-faint focus-visible:border-accent"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onCambiar('')}
          aria-label="Limpiar búsqueda"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-text-muted hover:text-text"
        >
          <IconoCerrar className="size-3.5" />
        </button>
      )}
    </div>
  )
}
