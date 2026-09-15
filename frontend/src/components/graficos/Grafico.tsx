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
import type { UmbralGrafico } from '@/utils/alertas'
import type { PuntoGrilla } from '@/utils/series'
import { fechaConAnio, fechaCorta, fechaHoraMs, hora } from '@/utils/tiempo'
import { medida, numero, numeroCon } from '@/utils/formato'
import { useZoomGrafico } from './usarZoomGrafico'
import { TooltipGrafico } from './TooltipGrafico'

type Props = {
  puntos: PuntoGrilla[]
  color: string
  unidad: string
  /* Nombre del sensor: entra en la alternativa textual del gráfico. */
  etiqueta: string
  /* Bordes de la ventana mostrada: fijan el dominio del eje X y el formato de sus ticks. */
  desdeMs: number
  hastaMs: number
  /* Todas las reglas activas del sensor, no sólo la disparada: un umbral que
     no se ve no explica por qué la lectura está donde está. */
  umbrales?: UmbralGrafico[]
  /* Instante donde el plan corta el historial. Se dibuja como pared: el trazo no
     empieza ahí, está cortado ahí. */
  corteDePlanMs?: number | null
  /* Sólo para magnitudes donde el cero es una lectura real (ver
     utils/sensores.ts:anclaEnCero). */
  desdeCero?: boolean
  onZoom?: (desdeMs: number, hastaMs: number) => void
  onRestablecer?: () => void
}

const DIA_MS = 86_400_000
const AIRE = 0.12
/* Separación mínima entre dos umbrales, como fracción del alto del cuadro, para
   que sus etiquetas quepan una arriba de la otra. */
const SEPARACION_ETIQUETA = 0.09

function formatterDeEje(duracionMs: number) {
  if (duracionMs < 2 * DIA_MS) return hora
  if (duracionMs < 365 * DIA_MS) return fechaCorta
  return fechaConAnio
}

/* Los decimales son los mismos en todos los ticks: es lo que hace que la columna
   se lea como una escala y no como valores sueltos. */
type Escala = { dominio: [number, number]; decimales: number }

/* Redondeo al múltiplo de un paso "lindo" (1, 2 o 5 por década): sin esto los
   bordes arrastran la basura decimal del aire (19,7806332) y Recharts reparte
   los ticks entre esos valores. */
function bordesLindos(min: number, max: number, desdeCero: boolean): Escala {
  const objetivo = (max - min) / 4
  const magnitud = Math.pow(10, Math.floor(Math.log10(objetivo)))
  const normal = objetivo / magnitud
  const paso = (normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10) * magnitud
  const decimales = Math.max(0, -Math.floor(Math.log10(paso)))
  const ajustar = (v: number) => Number(v.toFixed(decimales))
  return {
    dominio: [desdeCero ? 0 : ajustar(Math.floor(min / paso) * paso), ajustar(Math.ceil(max / paso) * paso)],
    decimales,
  }
}

/* El default de Recharts ([0, dataMax]) aplasta una serie de 19,9 a 20,4 °C
   contra el borde de arriba. Los umbrales entran al cálculo para que sus líneas
   no queden fuera de cuadro. undefined = sin datos numéricos, manda el default. */
function dominioY(
  puntos: PuntoGrilla[],
  umbrales: UmbralGrafico[],
  desdeCero: boolean,
): Escala | undefined {
  let min = Infinity
  let max = -Infinity
  for (const punto of puntos) {
    if (punto.valor === null) continue
    if (punto.valor < min) min = punto.valor
    if (punto.valor > max) max = punto.valor
  }
  if (min === Infinity) return undefined

  for (const { umbral } of umbrales) {
    min = Math.min(min, umbral)
    max = Math.max(max, umbral)
  }

  // Serie plana: sin un piso de aire el dominio queda de alto cero y el eje
  // colapsa en un solo tick.
  const aire = (max - min) * AIRE || Math.abs(max) * AIRE || 1
  return bordesLindos(min - aire, max + aire, desdeCero)
}

/* Dos umbrales cercanos apilarían sus etiquetas: el de abajo la manda debajo de
   su línea para que se separen. */
function lineasDeUmbral(umbrales: UmbralGrafico[], escala: Escala | undefined) {
  const separacion = escala ? (escala.dominio[1] - escala.dominio[0]) * SEPARACION_ETIQUETA : 0
  const orden = [...umbrales].sort((a, b) => a.umbral - b.umbral)
  return orden.map((linea, i) => {
    const siguiente = orden[i + 1]
    const apretada = siguiente !== undefined && siguiente.umbral - linea.umbral < separacion
    const posicion = apretada ? ('insideBottomRight' as const) : ('insideTopRight' as const)
    return { ...linea, posicion }
  })
}

/* Recharts emite un SVG con role="application" y nada legible adentro. */
function descripcionDe(
  puntos: PuntoGrilla[],
  etiqueta: string,
  unidad: string,
  desdeMs: number,
  hastaMs: number,
  corteDePlanMs: number | null | undefined,
): string {
  const ventana = `entre ${fechaHoraMs(desdeMs)} y ${fechaHoraMs(hastaMs)}`
  const valores = puntos.map((p) => p.valor).filter((v): v is number => v !== null)
  if (valores.length === 0) return `Gráfico de ${etiqueta}: sin lecturas ${ventana}.`
  // series.ts intercala un null por hueco, así que contarlos es contar tramos
  // sin datos: lo mismo que el trazo cortado comunica en pantalla.
  const huecos = puntos.length - valores.length
  const extremos = `de ${medida(Math.min(...valores), unidad)} a ${medida(Math.max(...valores), unidad)}`
  return (
    `Gráfico de ${etiqueta}: ${valores.length} puntos ${ventana}, ${extremos}.` +
    (huecos > 0 ? ` ${huecos} ${huecos === 1 ? 'tramo' : 'tramos'} sin datos.` : '') +
    (corteDePlanMs ? ' El borde izquierdo es el límite de retención del plan, no el inicio de las lecturas.' : '')
  )
}

/* Wrapper de Recharts: nada de la app importa la librería directo.
   isAnimationActive={false} porque anima por JS (prefers-reduced-motion no lo
   alcanza) y re-animaría en cada poll. */
export function Grafico({
  puntos,
  color,
  unidad,
  etiqueta,
  desdeMs,
  hastaMs,
  umbrales = [],
  corteDePlanMs,
  desdeCero = false,
  onZoom,
  onRestablecer,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const formatearTick = formatterDeEje(hastaMs - desdeMs)
  const escala = dominioY(puntos, umbrales, desdeCero)
  const lineas = lineasDeUmbral(umbrales, escala)
  const descripcion = descripcionDe(puntos, etiqueta, unidad, desdeMs, hastaMs, corteDePlanMs)
  const { contenedorRef, arrastre, manejadores } = useZoomGrafico({ desdeMs, hastaMs, onZoom, onRestablecer })

  // Una lectura sin vecino de ningún lado (rodeada de huecos, o sola en la
  // ventana) no dibuja trazo: sin un punto explícito sería invisible.
  const esAislado = (i: number) =>
    puntos[i]?.valor !== null &&
    (puntos[i - 1]?.valor ?? null) === null &&
    (puntos[i + 1]?.valor ?? null) === null

  // Sin ninguno, `dot={false}`: si no, Recharts emite un <g/> vacío por punto.
  const hayAislados = puntos.some((_, i) => esAislado(i))

  const renderPunto = ({ key, cx, cy, index }: DotItemDotProps) =>
    esAislado(index) ? <circle key={key} cx={cx} cy={cy} r={3} fill={color} /> : <g key={key} />

  return (
    <div
      ref={contenedorRef}
      role="img"
      aria-label={descripcion}
      className={`h-full w-full ${arrastre ? 'select-none' : ''}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {/* Aire arriba para que el tick más alto no toque el borde del cuadro. */}
        <AreaChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} {...manejadores}>
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
            tick={{ fontSize: 11, fontFamily: 'var(--font-reading)', fontWeight: 400 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            minTickGap={40}
          />
          {/* width="auto": con ancho fijo una presión de 1.015 hPa sale recortada.
              Sin etiqueta de unidad: dibujada arriba de la escala se encimaba con
              el tick más alto. La unidad la dice la cabecera del gráfico, una vez. */}
          <YAxis
            domain={escala?.dominio}
            stroke="var(--color-text-faint)"
            tick={{ fontSize: 11, fontFamily: 'var(--font-reading)', fontWeight: 400 }}
            tickLine={false}
            axisLine={false}
            width="auto"
            tickFormatter={(v: number) => (escala ? numeroCon(v, escala.decimales) : numero(v))}
          />
          <Tooltip content={<TooltipGrafico unidad={unidad} />} />
          {lineas.map(({ umbral, condicion, disparada, posicion }) => (
            <ReferenceLine
              key={`${condicion}:${umbral}`}
              y={umbral}
              stroke="var(--color-danger)"
              strokeDasharray="4 3"
              /* La regla disparada marcada más fuerte: con varias líneas iguales
                 no se distingue cuál es la que está sonando. */
              strokeOpacity={disparada ? 0.9 : 0.5}
              /* A la derecha: a la izquierda colisiona con los ticks del eje Y y
                 con la franja del recorte de plan. */
              label={{
                value: `${condicion === 'menor' ? '<' : '>'} ${medida(umbral, unidad)}`,
                position: posicion,
                fill: 'var(--color-danger)',
                fontSize: 10,
                fontFamily: 'var(--font-reading)',
                fontWeight: 500,
              }}
            />
          ))}
          {/* El eje ya arranca acá porque el backend recortó; sin la marca se lee
              como "el equipo empezó a reportar en esta fecha". */}
          {corteDePlanMs !== null && corteDePlanMs !== undefined && (
            <ReferenceArea
              x1={corteDePlanMs}
              x2={corteDePlanMs + (hastaMs - corteDePlanMs) * 0.008}
              fill="var(--color-accent)"
              fillOpacity={0.55}
              stroke="none"
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
            dot={hayAislados ? renderPunto : false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
