import { claveDeTipo, type ClaveSensor } from '@/utils/sensores'

/* Los mismos glifos que la landing (landing/src/componentes/equipo/Icono.astro):
   el cliente reconoce en la app la pieza que eligió al comprar. Luz comparte el
   de UV; ruido no tiene todavía. */
const SOL = (
  <>
    <circle cx="12" cy="12" r="3.6" />
    <path d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6.2 6.2l1.3 1.3M16.5 16.5l1.3 1.3M17.8 6.2l-1.3 1.3M7.5 16.5l-1.3 1.3" />
  </>
)

const TRAZOS: Partial<Record<ClaveSensor, React.ReactNode>> = {
  temperatura: (
    <>
      <path d="M14 13.6V6.5a2 2 0 1 0-4 0v7.1a4 4 0 1 0 4 0Z" />
      <path d="M17 8h3M17 12h2" />
    </>
  ),
  humedad: <path d="M12 3.6 7.9 8.5a6 6 0 1 0 8.2 0L12 3.6Z" />,
  co2: (
    <>
      <path d="M3.5 8.5h6.8a2.6 2.6 0 1 0-2.6-2.6" />
      <path d="M3.5 13.5h11.2a2.6 2.6 0 1 1-2.6 2.6" />
      <path d="M3.5 18.5h5.6" />
    </>
  ),
  presion: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 13l4.2-3.4M12 5.5v1.4" />
    </>
  ),
  suelo: (
    <>
      <path d="M12 20.5v-7.2" />
      <path d="M12 13.3c0-3 1.9-4.9 4.9-4.9 0 3-1.9 4.9-4.9 4.9Z" />
      <path d="M12 13.3c0-3-1.9-4.9-4.9-4.9 0 3 1.9 4.9 4.9 4.9Z" />
      <path d="M4 20.5h16" />
    </>
  ),
  uv: SOL,
  luz: SOL,
  bateria: (
    <>
      <rect x="3" y="8" width="15" height="9" rx="2.5" />
      <path d="M21 11.2v2.6M7 11v3M11 11v3" />
    </>
  ),
}

export function IconoSensor({
  tipo,
  className = 'size-3.5',
}: {
  tipo: string
  className?: string
}) {
  const trazos = TRAZOS[claveDeTipo(tipo)]
  if (!trazos) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {trazos}
    </svg>
  )
}
