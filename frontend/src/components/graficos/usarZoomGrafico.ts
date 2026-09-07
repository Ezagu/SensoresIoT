import { useEffect, useRef, useState } from 'react'
import type { MouseHandlerDataParam } from 'recharts'

/* Un arrastre más corto que esto es un click suelto (arranque === fin, o
   casi), no una selección real. */
const ZOOM_MINIMO_MS = 60_000
const FACTOR_ACERCAR = 0.8
const FACTOR_ALEJAR = 1.25
/* Sin este debounce, un solo gesto de rueda dispara un refetch por tick. */
const DEBOUNCE_RUEDA_MS = 200

/* Arrastrar selecciona un rango; ctrl+rueda acerca centrado en el cursor.
   Sin onZoom el gráfico queda de sólo lectura. */
export function useZoomGrafico({
  desdeMs,
  hastaMs,
  onZoom,
  onRestablecer,
}: {
  desdeMs: number
  hastaMs: number
  onZoom?: (desdeMs: number, hastaMs: number) => void
  onRestablecer?: () => void
}) {
  const puedeZoom = onZoom !== undefined
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [arrastre, setArrastre] = useState<{ inicio: number; fin: number } | null>(null)

  // Última posición del cursor sobre el dominio de datos: ancla del zoom por
  // rueda (centrado en el cursor, no en el medio del gráfico).
  const cursorRef = useRef<number | null>(null)
  // Espejo de los props, para que el listener de rueda (fuera del ciclo de
  // render de React) siempre lea el rango vigente. Se actualiza en un efecto
  // y no durante el render: escribir un ref en render rompe su pureza.
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

  /* onWheel de React se registra pasivo en el root: preventDefault() sería un
     no-op, hace falta un listener nativo. */
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

  return {
    contenedorRef,
    arrastre,
    manejadores: {
      onMouseDown: alBajar,
      onMouseMove: alMover,
      onMouseUp: alSoltar,
      onMouseLeave: alSalir,
      onDoubleClick: () => onRestablecer?.(),
    },
  }
}
