import { useEffect, useState } from 'react'
import { haceCuanto } from '@/lib/tiempo'

/* Cadencia según la edad: recién pasado se nota cada segundo, un equipo caído
   hace días no necesita recalcular más que una vez por hora. Se reevalúa en
   cada vuelta del timer, así que se acelera o desacelera sola sin que `iso`
   cambie. */
function proximoTic(segTranscurridos: number): number {
  if (segTranscurridos < 60) return 1_000
  if (segTranscurridos < 3600) return 60_000
  return 3_600_000
}

/* Componente y no hook: así sólo este nodo se re-renderiza cada tic, no el
   componente que lo usa (el panel entero, con todas sus tarjetas, si fuera un
   hook consumido ahí). Sin <span> propio: hereda el estilo del contenedor y no
   rompe el truncate de la tarjeta ni el layout del KPI. */
export function HaceCuanto({ iso }: { iso: string | null }) {
  const [, forzar] = useState(0)

  useEffect(() => {
    if (!iso) return
    let id: ReturnType<typeof setTimeout>

    function programar() {
      const seg = Math.round((Date.now() - new Date(iso!).getTime()) / 1000)
      id = setTimeout(() => {
        // Pestaña oculta: no vale la pena repintar, pero se sigue agendando
        // para ponerse al día solo al volver a estar visible (visibilitychange).
        if (!document.hidden) forzar((n) => n + 1)
        programar()
      }, proximoTic(seg))
    }
    programar()

    function alVolverVisible() {
      if (!document.hidden) forzar((n) => n + 1)
    }
    document.addEventListener('visibilitychange', alVolverVisible)

    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', alVolverVisible)
    }
  }, [iso])

  return haceCuanto(iso)
}
