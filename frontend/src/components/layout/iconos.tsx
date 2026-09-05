/* Íconos inline: todos decorativos (siempre acompañados de texto o de un
   aria-label en el botón), así que van con aria-hidden. */
type Props = { className?: string }

const base = (className = '') => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className,
})

export const IconoPanel = ({ className }: Props) => (
  <svg {...base(className)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
)

export const IconoDispositivo = ({ className }: Props) => (
  <svg {...base(className)}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

export const IconoAlerta = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M12 2a6 6 0 00-6 6c0 5-2 6-2 8h16c0-2-2-3-2-8a6 6 0 00-6-6z" />
    <path d="M10 20a2 2 0 004 0" />
  </svg>
)

/* Campana rellena, distinta de IconoAlerta: en el nav esa campana significa
   "la sección Alertas" y acá significa "esta regla está sonando". El mismo
   glifo para las dos cosas obligaba a deducir cuál era por el contexto. */
export const IconoAlertaSonando = ({ className }: Props) => (
  <svg {...base(className)} fill="currentColor">
    <path d="M12 2a6 6 0 00-6 6c0 5-2 6-2 8h16c0-2-2-3-2-8a6 6 0 00-6-6z" />
    <path d="M10 20a2 2 0 004 0" fill="none" />
  </svg>
)

export const IconoPlan = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M12 2l2.4 5.1 5.6.6-4.2 3.8 1.2 5.5L12 14.8 6.9 17l1.3-5.5L4 7.7l5.6-.6z" />
  </svg>
)

export const IconoAjustes = ({ className }: Props) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

export const IconoCuenta = ({ className }: Props) => (
  <svg {...base(className)}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </svg>
)

export const IconoMenu = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
)

export const IconoCerrar = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

export const IconoUbicacion = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)

export const IconoExportar = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </svg>
)

export const IconoMas = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconoChevron = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export const IconoReloj = ({ className }: Props) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const IconoProblema = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.6L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.6a2 2 0 00-3.4 0z" />
  </svg>
)

export const IconoOjo = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
)

export const IconoOjoTachado = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M10.6 6.2A9.8 9.8 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.3 3.9M6.4 7.6A17 17 0 002 12s3.6 6 10 6a9.9 9.9 0 004-.8" />
    <path d="M10 10a2.8 2.8 0 003.9 3.9M3 3l18 18" />
  </svg>
)

export const IconoCompartido = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M17 20c0-2.8-2.2-5-5-5s-5 2.2-5 5M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20c0-2.2-1.6-4-3.7-4.4M17.5 12a3 3 0 100-6" />
  </svg>
)

export const IconoActualizar = ({ className }: Props) => (
  <svg {...base(className)}>
    <path d="M21 12a9 9 0 10-2.6 6.4M21 12v-5M21 12h-5" />
  </svg>
)
