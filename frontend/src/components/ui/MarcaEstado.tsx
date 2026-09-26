/* Una forma por estado, ninguna repetida: el estado se lee impreso en blanco y
   negro, en una captura en escala de grises y por alguien que no distingue rojo
   de verde. El color refuerza, la forma es la que informa. */
export type Estado =
  | 'normal'
  | 'atencion'
  | 'advertencia'
  | 'critico'
  | 'sin-reportar'
  | 'sin-datos'
  | 'inactivo'

export const ETIQUETA: Record<Estado, string> = {
  normal: 'Normal',
  atencion: 'Con retraso',
  advertencia: 'Advertencia',
  critico: 'Crítico',
  'sin-reportar': 'Sin reportar',
  'sin-datos': 'Sin datos',
  inactivo: 'Desactivado',
}

/* El tono del glifo, que no es el del texto del mismo estado: el relleno va un
   escalón más claro para que el texto pueda sostener su propio contraste. */
const TINTA: Record<Estado, string> = {
  normal: 'var(--color-ok-mark)',
  atencion: 'var(--color-attention-mark)',
  advertencia: 'var(--color-warn-mark)',
  critico: 'var(--color-danger-mark)',
  'sin-reportar': 'var(--color-offline-mark)',
  'sin-datos': 'var(--color-offline-mark)',
  inactivo: 'var(--color-offline-mark)',
}

function Forma({ estado, color }: { estado: Estado; color: string }) {
  switch (estado) {
    case 'normal':
      return <circle cx="6" cy="6" r="4.5" fill={color} />
    case 'atencion':
      return <path d="M6 1 11 6 6 11 1 6Z" fill={color} />
    case 'advertencia':
      return <path d="M6 1.2 11.2 10.4H0.8Z" fill={color} />
    case 'critico':
      return <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill={color} />
    case 'sin-reportar':
      return <circle cx="6" cy="6" r="4" fill="none" stroke={color} strokeWidth="2.5" />
    case 'sin-datos':
      return <rect x="1" y="5" width="10" height="2" rx="1" fill={color} />
    case 'inactivo':
      return (
        <circle
          cx="6"
          cy="6"
          r="4"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="2.6 2.2"
        />
      )
  }
}

export function MarcaEstado({
  estado,
  /* Sólo en crítico, y sólo sobre el glifo: nunca late un bloque entero. */
  latiendo = false,
  className = '',
}: {
  estado: Estado
  latiendo?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`block size-2 shrink-0 ${
        latiendo && estado === 'critico' ? 'animate-latido' : ''
      } ${className}`}
    >
      <Forma estado={estado} color={TINTA[estado]} />
    </svg>
  )
}
