/* Marca de la app: el tile con el ícono más el wordmark. Vive acá porque
   aparece tanto en la sidebar como en el marco de auth. */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-6.5 shrink-0 items-center justify-center rounded-tile bg-accent-strong text-accent-ink">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-4"
        >
          <path d="M3 17l5-6 4 4 5-8 4 5" />
        </svg>
      </span>
      <span className="font-display text-brand font-bold tracking-tight text-text">Bitácora</span>
    </div>
  )
}
