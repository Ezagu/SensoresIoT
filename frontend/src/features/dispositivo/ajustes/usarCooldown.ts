import { useEffect, useState } from 'react'

function calcular(desde: string | null, duracionMs: number): number {
  if (!desde) return 0
  const vence = new Date(desde).getTime() + duracionMs
  return Math.max(0, vence - Date.now())
}

/* Ms restantes de cooldown desde `desde`, o 0 si ya pasó o no hay fecha.
   A diferencia de useAhora, no tiquea cada segundo para siempre: se
   reprograma con setTimeout y se apaga solo apenas llega a 0. */
export function useCooldown(desde: string | null, duracionMs: number): number {
  const [restante, setRestante] = useState(() => calcular(desde, duracionMs))

  useEffect(() => {
    const actualizar = () => {
      const restanteAhora = calcular(desde, duracionMs)
      setRestante(restanteAhora)
      if (restanteAhora <= 0) return
      const proximoTic = Math.min(restanteAhora, 1000)
      id = setTimeout(actualizar, proximoTic)
    }

    let id: ReturnType<typeof setTimeout>
    actualizar()
    return () => clearTimeout(id)
  }, [desde, duracionMs])

  return restante
}
