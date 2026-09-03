import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DotItemDotProps } from 'recharts'
import type { CondicionAlerta } from '@/lib/tipos'
import type { PuntoGrilla } from '@/lib/series'
import { fechaConAnio, fechaCorta, hora } from '@/lib/tiempo'
import { useZoomGrafico } from './usarZoomGrafico'
import { TooltipGrafico } from './TooltipGrafico'

type Props = {
  puntos: PuntoGrilla[]
  color: string
  unidad: string
  /* Bordes de la ventana mostrada, no un preset: fijan el dominio del eje X
     (así el silencio al principio o al final se ve como espacio vacío) y
     gobiernan el formato de sus ticks. */
  desdeMs: number
  hastaMs: number
  umbral?: number | null
  condicion?: CondicionAlerta | null
  onZoom?: (desdeMs: number, hastaMs: number) => void
  onRestablecer?: () => void
}

const DIA_MS = 86_400_000

function formatterDeEje(duracionMs: number) {
  if (duracionMs < 2 * DIA_MS) return hora
  if (duracionMs < 365 * DIA_MS) return fechaCorta
  return fechaConAnio
}

/* Wrapper de Recharts: nada de la app importa la librería directo. Puntos que
   no salen por default:
   - connectNulls={false} (default, pero explícito): un hueco corta el trazo
     en vez de interpolar — es la única señal visible de que un dispositivo
     dejó de reportar.
   - isAnimationActive={false}: Recharts anima por JS, así que
     prefers-reduced-motion no lo alcanza, y animar de cero en cada poll
     sería insoportable.
   - Colores por token (var(--color-*)): Recharts los pasa tal cual como
     atributos SVG, así que el tema claro/oscuro sigue funcionando solo. */
export function Grafico({
  puntos,
  color,
  unidad,
  desdeMs,
  hastaMs,
  umbral,
  condicion,
  onZoom,
  onRestablecer,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const formatearTick = formatterDeEje(hastaMs - desdeMs)
  const { contenedorRef, arrastre, manejadores } = useZoomGrafico({ desdeMs, hastaMs, onZoom, onRestablecer })

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
    <div ref={contenedorRef} className={`h-full w-full ${arrastre ? 'select-none' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={puntos} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} {...manejadores}>
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
          {arrastre && (
            <ReferenceArea
              x1={Math.min(arrastre.inicio, arrastre.fin)}
              x2={Math.max(arrastre.inicio, arrastre.fin)}
              fill="var(--color-accent)"
              fillOpacity={0.12}
              stroke="var(--color-accent)"
              strokeOpacity={0.4}
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
    </div>
  )
}
