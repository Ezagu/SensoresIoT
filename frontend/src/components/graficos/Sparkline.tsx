import type { PuntoGrilla } from '@/utils/series'

type Tono = 'acento' | 'critico' | 'apagado'

const TRAZO: Record<Tono, string> = {
  acento: 'stroke-chart-line fill-chart-line',
  critico: 'stroke-chart-threshold fill-chart-threshold',
  apagado: 'stroke-chart-line-2 fill-chart-line-2',
}

/* Tendencia dentro de una fila: sin ejes, sin tooltip, sin escala compartida
   entre filas. Si hace falta leer un valor, corresponde el gráfico grande.
   Toma la misma grilla que Grafico, así que hereda los huecos ya marcados: una
   sparkline que interpola miente más barato, pero miente igual. */
export function Sparkline({
  puntos,
  tono = 'acento',
  ancho = 150,
  alto = 30,
  grosor = 1.5,
}: {
  puntos: PuntoGrilla[]
  tono?: Tono
  ancho?: number
  alto?: number
  grosor?: number
}) {
  const valores = puntos.map((p) => p.valor)
  const reales = valores.filter((v): v is number => v !== null)

  const marco = (hijos?: React.ReactNode) => (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      aria-hidden="true"
      className={`shrink-0 ${TRAZO[tono]}`}
    >
      {hijos}
    </svg>
  )

  if (reales.length === 0) return marco()

  const min = Math.min(...reales)
  const max = Math.max(...reales)
  /* Una serie plana se dibuja en el medio, no pegada a un borde. */
  const rango = max - min || 1
  const x = (i: number) => (i / Math.max(1, puntos.length - 1)) * (ancho - grosor) + grosor / 2
  const y = (v: number) =>
    max === min ? alto / 2 : alto - grosor / 2 - ((v - min) / rango) * (alto - grosor)

  const tramos: { x: number; y: number }[][] = []
  let actual: { x: number; y: number }[] = []
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) tramos.push(actual)
      actual = []
      return
    }
    actual.push({ x: x(i), y: y(v) })
  })
  if (actual.length) tramos.push(actual)

  return marco(
    tramos.map((tramo, i) =>
      /* Un tramo de un punto solo no dibuja polilínea: entre dos huecos, una
         lectura aislada tiene que verse igual. */
      tramo.length === 1 ? (
        <circle key={i} cx={tramo[0].x} cy={tramo[0].y} r={grosor} stroke="none" />
      ) : (
        <polyline
          key={i}
          points={tramo.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
          fill="none"
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ),
    ),
  )
}
