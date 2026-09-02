import { useEffect, useId, useRef, useState } from 'react'
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
import type { DotItemDotProps, MouseHandlerDataParam } from 'recharts'
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
  /* Arrastrar selecciona un rango y dispara onZoom(desdeMs, hastaMs); doble
     click dispara onRestablecer. Sin estas dos props el gráfico queda de sólo
     lectura, como antes — nada obliga a un consumidor a ofrecer zoom. */
  onZoom?: (desdeMs: number, hastaMs: number) => void
  onRestablecer?: () => void
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

/* Un arrastre más corto que esto es un click suelto (arranque === fin, o casi),
   no una selección real. */
const ZOOM_MINIMO_MS = 60_000
const FACTOR_ACERCAR = 0.8
const FACTOR_ALEJAR = 1.25
/* Sin este debounce, un solo gesto de rueda dispara un refetch por tick. */
const DEBOUNCE_RUEDA_MS = 200

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
  const puedeZoom = onZoom !== undefined

  const contenedorRef = useRef<HTMLDivElement>(null)
  const [arrastre, setArrastre] = useState<{ inicio: number; fin: number } | null>(null)

  // Última posición del cursor sobre el dominio de datos: ancla del zoom por
  // rueda (centrado en el cursor, no en el medio del gráfico).
  const cursorRef = useRef<number | null>(null)
  // Espejo de los props, para que el listener de rueda (fuera del ciclo de
  // render de React) siempre lea el rango vigente. Se actualiza en un efecto
  // y no durante el render: escribir un ref en render rompe su pureza (una
  // pasada abortada por React dejaría el ref con un valor que nunca se pintó).
  const rangoRef = useRef({ desdeMs, hastaMs })
  useEffect(() => {
    rangoRef.current = { desdeMs, hastaMs }
  }, [desdeMs, hastaMs])
  // Acumula varios ticks de un mismo gesto antes de aplicar: sin esto, cada
  // tick partiría de rangoRef (que no cambia hasta que onZoom confirma), y un
  // gesto rápido de varios ticks terminaría zoomeando lo mismo que uno solo.
  const pendienteRef = useRef<{ desdeMs: number; hastaMs: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function alBajar(estado: MouseHandlerDataParam) {
    if (!puedeZoom || typeof estado.activeLabel !== 'number') return
    setArrastre({ inicio: estado.activeLabel, fin: estado.activeLabel })
  }

  function alMover(estado: MouseHandlerDataParam) {
    if (typeof estado.activeLabel !== 'number') return
    cursorRef.current = estado.activeLabel
    setArrastre((a) => (a ? { ...a, fin: estado.activeLabel as number } : a))
  }

  function alSoltar() {
    if (!arrastre) return
    const ini = Math.min(arrastre.inicio, arrastre.fin)
    const fin = Math.max(arrastre.inicio, arrastre.fin)
    setArrastre(null)
    if (fin - ini >= ZOOM_MINIMO_MS) onZoom?.(ini, fin)
  }

  // Si el mouse sale del gráfico apretado, se descarta: mejor perder el
  // arrastre que quedar con el estado colgado esperando un mouseup que no va
  // a llegar adentro del SVG.
  function alSalir() {
    setArrastre(null)
  }

  /* Ctrl+rueda no puede ir por onWheel de React: desde React 17 ese listener
     se registra pasivo en el root, así que preventDefault() es un no-op (y
     tira warning en consola) — hace falta un listener nativo no-pasivo. */
  useEffect(() => {
    if (!puedeZoom) return
    const el = contenedorRef.current
    if (!el) return

    function alRueda(e: WheelEvent) {
      if (!e.ctrlKey) return
      e.preventDefault()

      const base = pendienteRef.current ?? rangoRef.current
      const factor = e.deltaY < 0 ? FACTOR_ACERCAR : FACTOR_ALEJAR
      const centro = cursorRef.current ?? (base.desdeMs + base.hastaMs) / 2

      let nuevoDesde = centro - (centro - base.desdeMs) * factor
      let nuevoHasta = centro + (base.hastaMs - centro) * factor
      // Alejar no puede empujar el borde derecho al futuro; el desde que se
      // pase de la retención del plan no se corta acá, ya lo hace el backend.
      if (nuevoHasta > Date.now()) {
        nuevoDesde -= nuevoHasta - Date.now()
        nuevoHasta = Date.now()
      }

      pendienteRef.current = { desdeMs: nuevoDesde, hastaMs: nuevoHasta }
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const p = pendienteRef.current
        pendienteRef.current = null
        if (p) onZoom?.(p.desdeMs, p.hastaMs)
      }, DEBOUNCE_RUEDA_MS)
    }

    el.addEventListener('wheel', alRueda, { passive: false })
    return () => el.removeEventListener('wheel', alRueda)
  }, [puedeZoom, onZoom])

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
    <div
      ref={contenedorRef}
      className={`h-full w-full ${arrastre ? 'select-none' : ''}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={puntos}
          margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
          onMouseDown={alBajar}
          onMouseMove={alMover}
          onMouseUp={alSoltar}
          onMouseLeave={alSalir}
          onDoubleClick={() => onRestablecer?.()}
        >
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
