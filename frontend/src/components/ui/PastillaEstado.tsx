import { ETIQUETA_ESTADO, type EstadoDispositivo } from '@/utils/tiempo'
import { ETIQUETA, MarcaEstado, type Estado } from './MarcaEstado'

const TONOS: Record<Estado, string> = {
  normal: 'text-ok',
  atencion: 'text-attention',
  advertencia: 'text-warn',
  critico: 'text-danger',
  'sin-reportar': 'text-offline',
  'sin-datos': 'text-offline',
  inactivo: 'text-disabled-text',
}

/* La cápsula lleva wash y borde propios; suelta, sólo el color del texto. */
const CAPSULA: Record<Estado, string> = {
  normal: 'bg-ok-soft border-ok-border',
  atencion: 'bg-attention-soft border-attention-border',
  advertencia: 'bg-warn-soft border-warn-border',
  critico: 'bg-danger-soft border-danger-border',
  'sin-reportar': 'bg-offline-soft border-border-control',
  'sin-datos': 'bg-transparent border-border-control',
  inactivo: 'bg-surface-inert border-border',
}

/* Estado de un equipo o de un sensor. Cápsula cuando el estado está suelto sobre
   el fondo (cabeceras); en una lista va sin cápsula, que ahí el renglón ya
   delimita. El glifo hace el trabajo: el color es refuerzo. */
export function PastillaEstado({
  estado,
  etiqueta,
  /* Dato que califica el estado: "hace 43 min", "1 alerta". */
  detalle,
  capsula = true,
  latiendo = false,
}: {
  estado: Estado
  etiqueta?: string
  detalle?: string
  capsula?: boolean
  latiendo?: boolean
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.75 whitespace-nowrap ${TONOS[estado]} ${
        capsula ? `h-5.5 rounded-full border pr-2.25 pl-1.75 ${CAPSULA[estado]}` : ''
      }`}
    >
      <MarcaEstado estado={estado} latiendo={latiendo} />
      <span className="text-body font-medium">{etiqueta ?? ETIQUETA[estado]}</span>
      {detalle && <span className="num text-note-lg text-text-muted">{detalle}</span>}
    </span>
  )
}

/* Un equipo dado de baja no tiene estado de conexión que informar, así que la
   baja gana sobre los tres estados de conectividad. */
const FORMA_DE_ESTADO: Record<EstadoDispositivo, Estado> = {
  nunca: 'sin-datos',
  'en-linea': 'normal',
  'con-retraso': 'atencion',
  'sin-reportar': 'sin-reportar',
}

export function PastillaEquipo({
  estado,
  inactivo = false,
  detalle,
}: {
  estado: EstadoDispositivo
  inactivo?: boolean
  detalle?: string
}) {
  if (inactivo) return <PastillaEstado estado="inactivo" detalle={detalle} />
  return (
    <PastillaEstado
      estado={FORMA_DE_ESTADO[estado]}
      etiqueta={ETIQUETA_ESTADO[estado]}
      detalle={detalle}
    />
  )
}
