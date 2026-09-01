import { useId } from 'react'

/* La tira: línea continua + área degradada del mismo color.
   - Un hueco (null) corta el trazo en tramos separados, nunca se interpola:
     el silencio de un equipo tiene que verse, y hoy no existe alerta de
     "dejó de reportar" que lo cubra.
   - Los tramos que superan el umbral se remarcan en danger encima del trazo.
   El viewBox es fijo y escala solo por CSS, así que no hace falta medir ancho
   ni recalcular en resize. */

const W = 100
const H = 40
const PAD_TOP = 4
const PAD_BOTTOM = 3

type Props = {
  valores: (number | null)[]
  color: string
  umbral?: number | null
  className?: string
}

type Punto = { i: number; v: number }

export function Tira({ valores, color, umbral, className = '' }: Props) {
  const uid = useId().replace(/:/g, '')
  const finitos = valores.filter((v): v is number => v !== null)
  if (finitos.length === 0) return <div className={className} />

  const min = Math.min(...finitos)
  const max = Math.max(...finitos)
  const span = max - min || 1
  const stepX = valores.length > 1 ? W / (valores.length - 1) : 0

  const x = (i: number) => (i * stepX).toFixed(2)
  const y = (v: number) => (H - PAD_BOTTOM - ((v - min) / span) * (H - PAD_TOP - PAD_BOTTOM)).toFixed(2)

  const tramos: Punto[][] = []
  let actual: Punto[] | null = null
  valores.forEach((v, i) => {
    if (v === null) {
      actual = null
      return
    }
    if (!actual) {
      actual = []
      tramos.push(actual)
    }
    actual.push({ i, v })
  })

  const hayUmbral = umbral !== undefined && umbral !== null
  const baseY = H - PAD_BOTTOM

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`block w-full h-full ${className}`}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {hayUmbral && umbral > min && umbral < max && (
        <line
          x1="0"
          y1={y(umbral)}
          x2={W}
          y2={y(umbral)}
          stroke="var(--color-danger)"
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {tramos.map((tramo, idx) => {
        if (tramo.length < 2) {
          return (
            <circle key={idx} cx={x(tramo[0].i)} cy={y(tramo[0].v)} r={1.6} fill={color} />
          )
        }
        const puntos = tramo.map((p) => `${x(p.i)},${y(p.v)}`).join(' L ')
        const primero = tramo[0]
        const ultimo = tramo[tramo.length - 1]

        /* Sub-tramos por encima del umbral, para remarcarlos sin repintar todo */
        const excedidos: Punto[][] = []
        if (hayUmbral) {
          let run: Punto[] | null = null
          for (const p of tramo) {
            if (p.v > umbral) {
              if (!run) {
                run = []
                excedidos.push(run)
              }
              run.push(p)
            } else {
              run = null
            }
          }
        }

        return (
          <g key={idx}>
            <path
              d={`M ${x(primero.i)},${baseY} L ${puntos} L ${x(ultimo.i)},${baseY} Z`}
              fill={`url(#${uid})`}
            />
            <path
              d={`M ${puntos}`}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {excedidos
              .filter((r) => r.length >= 2)
              .map((r, j) => (
                <path
                  key={j}
                  d={`M ${r.map((p) => `${x(p.i)},${y(p.v)}`).join(' L ')}`}
                  fill="none"
                  stroke="var(--color-danger)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </g>
        )
      })}
    </svg>
  )
}
