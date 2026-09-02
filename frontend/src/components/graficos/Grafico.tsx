import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DotItemDotProps } from 'recharts'
import type { CondicionAlerta } from '@/lib/tipos'
import type { PuntoGrilla } from '@/lib/series'
import { medida } from '@/lib/formato'
import { fechaConAnio, fechaCorta, fechaHora, hora } from '@/lib/tiempo'

type Props = {
  puntos: PuntoGrilla[]
  color: string
  unidad: string
  /* Bordes de la ventana mostrada, no un preset: fijan el dominio del eje X
     (así el silencio al principio o al final se ve como espacio vacío, no
     como un eje que se encoge a los datos) y gobiernan el formato de sus
     ticks, así que un rango de fechas arbitrario también sabe elegir. */
  desdeMs: number
  hastaMs: number
  umbral?: number | null
  condicion?: CondicionAlerta | null
}

const DIA_MS = 86_400_000

function formatterDeEje(duracionMs: number) {
  if (duracionMs < 2 * DIA_MS) return hora
  if (duracionMs < 365 * DIA_MS) return fechaCorta
  return fechaConAnio
}

function TooltipGrafico({
  active,
  payload,
  unidad,
}: {
  active?: boolean
  payload?: { payload: PuntoGrilla }[]
  unidad: string
}) {
  if (!active || !payload?.length) return null
  const punto = payload[0].payload
  if (punto.valor === null) return null
  return (
    <div className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-note-lg shadow-sm">
      <p className="text-text-faint">{fechaHora(new Date(punto.t).toISOString())}</p>
      <p className="num font-semibold text-text">{medida(punto.valor, unidad)}</p>
    </div>
  )
}

/* Wrapper de Recharts: nada de la app importa la librería directo. Puntos que
   no salen por default:
   - connectNulls={false} (default, pero explícito): un hueco corta el trazo
     en vez de interpolar — es la única señal visible de que un dispositivo
     dejó de reportar.
   - isAnimationActive={false}: Recharts anima por JS, así que
     prefers-reduced-motion (index.css) no lo alcanza; además animar de cero
     en cada poll sería insoportable.
   - Colores por token (var(--color-*)): Recharts los pasa tal cual como
     atributos SVG, así que el tema claro/oscuro sigue funcionando solo. */
export function Grafico({ puntos, color, unidad, desdeMs, hastaMs, umbral, condicion }: Props) {
  const uid = useId().replace(/:/g, '')
  const formatearTick = formatterDeEje(hastaMs - desdeMs)

  // Una lectura sin vecino de ningún lado (rodeada de huecos, o sola en la
  // ventana) no dibuja trazo: sin un punto explícito sería invisible.
  const renderPunto = ({ key, cx, cy, index }: DotItemDotProps) => {
    if (puntos[index]?.valor === null) return <g key={key} />
    const anterior = puntos[index - 1]
    const siguiente = puntos[index + 1]
    const aislado = (anterior?.valor ?? null) === null && (siguiente?.valor ?? null) === null
    if (!aislado) return <g key={key} />
    return <circle key={key} cx={cx} cy={cy} r={3} fill={color} />
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={puntos} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[desdeMs, hastaMs]}
          tickFormatter={formatearTick}
          stroke="var(--color-text-faint)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border)' }}
          minTickGap={40}
        />
        <YAxis
          stroke="var(--color-text-faint)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<TooltipGrafico unidad={unidad} />} />
        {umbral !== null && umbral !== undefined && (
          <ReferenceLine
            y={umbral}
            stroke="var(--color-danger)"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
            label={{
              value: condicion === 'menor' ? `< ${umbral}` : `> ${umbral}`,
              position: 'insideTopLeft',
              fill: 'var(--color-danger)',
              fontSize: 10,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="valor"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${uid})`}
          connectNulls={false}
          isAnimationActive={false}
          dot={renderPunto}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
