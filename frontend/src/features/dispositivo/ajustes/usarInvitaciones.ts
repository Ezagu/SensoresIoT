import { useCallback } from 'react'
import { listarInvitaciones } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'

/* No pollea: las invitaciones no cambian solas mientras se mira la pantalla.
   `habilitado` evita el pedido para quien no es dueño: el backend responde 403
   a GET /invitaciones si no lo es. */
export function useInvitaciones(dispositivoId: string, habilitado: boolean) {
  const cargar = useCallback(
    (signal: AbortSignal) => (habilitado ? listarInvitaciones(dispositivoId, signal) : Promise.resolve([])),
    [dispositivoId, habilitado],
  )
  return useCarga(cargar)
}
