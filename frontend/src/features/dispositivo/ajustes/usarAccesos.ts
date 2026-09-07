import { useCallback } from 'react'
import { listarAccesos } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'

/* No pollea: quién tiene acceso a un equipo no cambia mientras se lo mira. */
export function useAccesos(dispositivoId: string) {
  const cargar = useCallback(
    (signal: AbortSignal) => listarAccesos(dispositivoId, signal),
    [dispositivoId],
  )
  return useCarga(cargar)
}
