import { useCallback } from 'react'
import { obtenerPreferencias } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'

/* No pollea: son preferencias de la cuenta, sólo las cambia quien las mira. */
export function usePreferencias() {
  const cargar = useCallback((signal: AbortSignal) => obtenerPreferencias(signal), [])
  return useCarga(cargar)
}
