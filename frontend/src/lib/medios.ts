import { useCallback, useSyncExternalStore } from 'react'

/* `matchMedia` es estado externo al de React: se lee de la fuente en vez de
   espejarlo en useState, así no hay un render intermedio con el valor viejo ni
   una suscripción escrita a mano en cada consumidor. */
export function useMediaQuery(consulta: string) {
  const suscribir = useCallback(
    (avisar: () => void) => {
      const mq = window.matchMedia(consulta)
      mq.addEventListener('change', avisar)
      return () => mq.removeEventListener('change', avisar)
    },
    [consulta],
  )

  return useSyncExternalStore(suscribir, () => window.matchMedia(consulta).matches)
}
