import { useEffect, useState } from 'react'
import { haceCuanto } from '@/utils/tiempo'

/* Recién pasado se nota cada segundo; un equipo caído hace días, una vez por
   hora. Se reevalúa en cada vuelta del timer. */
function proximoTic(segTranscurridos: number): number {
  if (segTranscurridos < 60) return 1_000
  if (segTranscurridos < 3600) return 60_000
  return 3_600_000
}

/* Componente y no hook: así sólo este nodo se repinta cada tic, no el panel
   entero. Sin <span> propio, para no romper el truncate del contenedor. */
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
