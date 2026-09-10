import { useEffect, useState } from 'react'

/* Re-render periódico para lo que se deriva de la hora actual: el borde derecho
   de una ventana en vivo y la frescura de una lectura. El estado del equipo ya
   no sale de acá — lo resuelve el backend. */
export function useAhora(intervaloMs: number) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}
