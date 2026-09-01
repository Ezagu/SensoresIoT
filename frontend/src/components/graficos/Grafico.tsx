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
import type { CondicionAlerta } from '@/lib/tipos'
import type { PuntoGrilla } from '@/lib/series'
import type { RangoGrafico } from '@/lib/dispositivos'
import { medida } from '@/lib/formato'
import { fechaCorta, fechaHora, hora } from '@/lib/tiempo'

type Props = {
  puntos: PuntoGrilla[]
  color: string
  unidad: string
  rango: RangoGrafico
  umbral?: number | null
  condicion?: CondicionAlerta | null
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
     en vez de interpolar, mismo criterio que Tira — es la única señal visible
     de que un dispositivo dejó de reportar.
   - isAnimationActive={false}: Recharts anima por JS, así que
     prefers-reduced-motion (index.css) no lo alcanza; además animar de cero
     en cada poll sería insoportable.
   - Colores por token (var(--color-*)): Recharts los pasa tal cual como
     atributos SVG, así que el tema claro/oscuro sigue funcionando solo. */
export function Grafico({ puntos, color, unidad, rango, umbral, condicion }: Props) {
  const uid = useId().replace(/:/g, '')
  const formatearTick = rango === '24h' ? hora : fechaCorta

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
          domain={['dataMin', 'dataMax']}
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
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
