import { useEffect, useState } from 'react'

/* Re-render periódico para lo que se deriva de la hora actual: sin esto un
   dispositivo queda "En línea" para siempre aunque haya dejado de reportar. */
export function useAhora(intervaloMs: number) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}
