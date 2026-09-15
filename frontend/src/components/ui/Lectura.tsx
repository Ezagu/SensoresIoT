import { numero } from '@/utils/formato'

type Tamano = 'sm' | 'md' | 'lg'
type Tono = 'normal' | 'atencion' | 'advertencia' | 'critico'

const TAMANOS: Record<Tamano, string> = {
  sm: 'text-body-lg',
  md: 'text-metric',
  lg: 'text-hero',
}

const TONOS: Record<Tono, string> = {
  normal: 'text-text',
  atencion: 'text-attention',
  advertencia: 'text-warn',
  critico: 'text-danger',
}

/* Un valor medido con su unidad. Ausente es una raya, nunca un cero: un cero es
   una lectura y "no llegó nada" no lo es.
   `apagado` es un dato viejo pero válido —se apaga, no se pinta de rojo—, que es
   otra cosa que un umbral cruzado. */
export function Lectura({
  valor,
  unidad,
  tamano = 'sm',
  tono = 'normal',
  apagado = false,
}: {
  valor: number | null
  unidad: string
  tamano?: Tamano
  tono?: Tono
  apagado?: boolean
}) {
  const color = apagado ? 'text-text-muted' : TONOS[tono]
  return (
    <span className={`num inline-flex items-baseline gap-1 leading-tight ${TAMANOS[tamano]} ${color}`}>
      {valor === null ? (
        <span className="text-offline-mark">—</span>
      ) : (
        <>
          {numero(valor)}
          {/* Sin unidad no hay span vacío: dejaría el hueco del gap colgando
              después del número (un conteo de lecturas no mide nada). */}
          {unidad && (
            <span className="text-note-lg font-medium tracking-normal text-text-muted">{unidad}</span>
          )}
        </>
      )}
    </span>
  )
}
