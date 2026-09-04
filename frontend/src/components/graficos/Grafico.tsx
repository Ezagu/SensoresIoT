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
  /* Sólo para magnitudes donde el cero es una lectura real (ver
     lib/sensores.ts:anclaEnCero). */
  desdeCero?: boolean
  onZoom?: (desdeMs: number, hastaMs: number) => void
  onRestablecer?: () => void
}

const DIA_MS = 86_400_000
const AIRE = 0.12

function formatterDeEje(duracionMs: number) {
  if (duracionMs < 2 * DIA_MS) return hora
  if (duracionMs < 365 * DIA_MS) return fechaCorta
  return fechaConAnio
}

/* Bordes redondeados al múltiplo de un paso "lindo" (1, 2 o 5 por década).
   Sin esto los bordes arrastran la basura decimal del aire (19,7806332) y
   Recharts reparte los ticks entre esos valores: números que ni caben en el
   ancho del eje ni significan nada. */
function bordesLindos(min: number, max: number, desdeCero: boolean): [number, number] {
  const objetivo = (max - min) / 4
  const magnitud = Math.pow(10, Math.floor(Math.log10(objetivo)))
  const normal = objetivo / magnitud
  const paso = (normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10) * magnitud
  const decimales = Math.max(0, -Math.floor(Math.log10(paso)))
  const ajustar = (v: number) => Number(v.toFixed(decimales))
  return [desdeCero ? 0 : ajustar(Math.floor(min / paso) * paso), ajustar(Math.ceil(max / paso) * paso)]
}

/* El default de Recharts es [0, dataMax], que en una serie de 19,9 a 20,4 °C
   deja el trazo aplastado contra el borde de arriba y el resto del cuadro
   relleno. El dominio sale de la serie con aire proporcional, y el umbral de la
   regla entra al cálculo para que su línea nunca quede fuera de cuadro.
   Devuelve undefined sin datos numéricos: ahí manda el default. */
function dominioY(
  puntos: PuntoGrilla[],
  umbral: number | null | undefined,
  desdeCero: boolean,
): [number, number] | undefined {
  let min = Infinity
  let max = -Infinity
  for (const punto of puntos) {
    if (punto.valor === null) continue
    if (punto.valor < min) min = punto.valor
    if (punto.valor > max) max = punto.valor
  }
  if (min === Infinity) return undefined

  if (umbral !== null && umbral !== undefined) {
    min = Math.min(min, umbral)
    max = Math.max(max, umbral)
  }

  // Serie plana: sin un piso de aire el dominio queda de alto cero y el eje
  // colapsa en un solo tick.
  const aire = (max - min) * AIRE || Math.abs(max) * AIRE || 1
  return bordesLindos(min - aire, max + aire, desdeCero)
}

/* Wrapper de Recharts: nada de la app importa la librería directo.
   isAnimationActive={false} porque Recharts anima por JS (prefers-reduced-motion
   no lo alcanza) y re-animar en cada poll sería insoportable. */
export function Grafico({
  puntos,
  color,
  unidad,
  desdeMs,
  hastaMs,
  umbral,
  condicion,
  desdeCero = false,
  onZoom,
  onRestablecer,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const formatearTick = formatterDeEje(hastaMs - desdeMs)
  const dominio = dominioY(puntos, umbral, desdeCero)
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
            domain={dominio}
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
