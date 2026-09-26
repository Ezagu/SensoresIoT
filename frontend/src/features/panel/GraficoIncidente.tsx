import { useId } from 'react'
import type { CondicionAlerta, DatosGrafico } from '@/tipos'
import { serieDeGrafico } from '@/utils/series'
import { hora } from '@/utils/tiempo'

const ANCHO = 360
const ALTO = 110
/* Franja de abajo reservada al marcador de cuándo se disparó. */
const PIE = 12

/* Con preserveAspectRatio="none" un <circle> se estira en óvalo: un trazo de
   largo cero con non-scaling-stroke queda redondo o cuadrado a cualquier ancho. */
function Punto({
  cx,
  cy,
  lado,
  forma,
}: {
  cx: number
  cy: number
  lado: number
  forma: 'round' | 'square'
}) {
  return (
    <line
      x1={cx}
      x2={cx}
      y1={cy}
      y2={cy}
      strokeWidth={lado}
      strokeLinecap={forma}
      vectorEffect="non-scaling-stroke"
      className="stroke-chart-threshold"
    />
  )
}

/* SVG a mano y no Recharts: el panel no carga la librería de gráficos (ver
   App.tsx) y acá no hay tooltip ni zoom, sólo la forma del cruce. El tramo que
   pasa el umbral se repinta en rojo recortando la misma línea, así el color
   cambia exactamente donde cruza. */
export function GraficoIncidente({
  datos,
  umbral,
  condicion,
  desdeMs,
  hastaMs,
  disparadaDesde,
  titulo,
}: {
  datos: DatosGrafico
  umbral: number
  condicion: CondicionAlerta
  desdeMs: number
  hastaMs: number
  disparadaDesde: string | null
  titulo: string
}) {
  const recorte = useId()
  const serie = serieDeGrafico(datos)
  const valores = serie.map((p) => p.valor).filter((v): v is number => v !== null)

  const min = Math.min(umbral, ...valores)
  const max = Math.max(umbral, ...valores)
  const margen = (max - min || Math.abs(umbral) || 1) * 0.15
  const bajo = min - margen
  const alto = max + margen

  const x = (t: number) => ((t - desdeMs) / (hastaMs - desdeMs)) * ANCHO
  const y = (v: number) => (ALTO - PIE) * (1 - (v - bajo) / (alto - bajo))
  const yUmbral = y(umbral)

  const tramos: string[] = []
  let actual: string[] = []
  for (const p of serie) {
    if (p.valor === null) {
      if (actual.length) tramos.push(actual.join(' '))
      actual = []
    } else {
      actual.push(`${x(p.t).toFixed(1)},${y(p.valor).toFixed(1)}`)
    }
  }
  if (actual.length) tramos.push(actual.join(' '))

  const ultimo = [...serie].reverse().find((p) => p.valor !== null)
  const disparoMs = disparadaDesde ? new Date(disparadaDesde).getTime() : null
  const zona =
    condicion === 'mayor' ? { y: 0, height: yUmbral } : { y: yUmbral, height: ALTO - yUmbral }

  const linea = (clase: string, ancho: number, clip?: string) =>
    tramos.map((puntos, i) => (
      <polyline
        key={i}
        points={puntos}
        fill="none"
        strokeWidth={ancho}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        clipPath={clip}
        className={clase}
      />
    ))

  return (
    <div className="flex min-w-0 flex-col justify-end gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-note-lg text-text-muted">{titulo}</span>
        <span className="micro shrink-0">Últimas 2 h</span>
      </div>
      <div className="relative">
        {tramos.length === 0 && (
          <p className="absolute inset-x-0 top-2 text-center text-note text-text-faint">
            Sin lecturas en las últimas 2 h
          </p>
        )}
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${titulo}, últimas 2 horas`}
          className="h-27.5 w-full overflow-visible"
        >
          <defs>
            <clipPath id={recorte}>
              <rect x={0} width={ANCHO} {...zona} />
            </clipPath>
          </defs>
          <line
            x1={0}
            x2={ANCHO}
            y1={yUmbral}
            y2={yUmbral}
            strokeDasharray="4 6"
            vectorEffect="non-scaling-stroke"
            className="stroke-chart-threshold opacity-60"
          />
          {linea('stroke-chart-line opacity-70', 1.8)}
          {linea('stroke-chart-threshold', 2, `url(#${recorte})`)}
          {ultimo && ultimo.valor !== null && (
            <Punto cx={x(ultimo.t)} cy={y(ultimo.valor)} lado={7} forma="round" />
          )}
          {disparoMs !== null && disparoMs >= desdeMs && (
            <Punto cx={x(disparoMs)} cy={ALTO - 4} lado={6} forma="square" />
          )}
        </svg>
      </div>
      <div className="flex justify-between">
        <span className="micro">{hora(desdeMs)}</span>
        <span className="micro">{hora((desdeMs + hastaMs) / 2)}</span>
        <span className="micro">Ahora</span>
      </div>
    </div>
  )
}
