import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useSesion } from '@/features/auth/sesion'
import { obtenerPanel } from '@/services/consultas'
import { useCarga } from './usarCarga'

/* Todos los equipos con sus sensores y última lectura, en un solo request. La
   cadencia sale del resultado: el intervalo mínimo de la cartera. */
function useCargaDispositivos() {
  const { sesion } = useSesion()
  const usuarioId = sesion?.usuario_id
  const [cadenciaSeg, setCadenciaSeg] = useState<number>()

  const cargar = useCallback(
    async (signal: AbortSignal) => {
      if (!usuarioId) return []
      const panel = await obtenerPanel(usuarioId, signal)
      return panel.dispositivos
    },
    [usuarioId],
  )

  const estado = useCarga(cargar, {
    intervaloMs: cadenciaSeg !== undefined ? cadenciaSeg * 1000 : undefined,
  })

  // Derivado en el render y no en un efecto: no hay nada que sincronizar, sólo
  // una cadencia que se conoce recién con la primera respuesta.
  const menor = estado.datos?.length
    ? Math.min(...estado.datos.map((d) => d.intervalo_efectivo_seg))
    : undefined
  if (menor !== undefined && menor !== cadenciaSeg) setCadenciaSeg(menor)

  return { ...estado, cadenciaSeg }
}

type ContextoValor = ReturnType<typeof useCargaDispositivos>
const Ctx = createContext<ContextoValor | null>(null)

/* Un solo poll para toda la sesión, montado en Guardia (ver App.tsx) y no en
   cada pantalla: el panel, el roster de la sidebar y el registro de avisos
   miran la misma cartera, y pedirla una vez por pantalla la triplicaba en cada
   navegación en vez de compartir el mismo ciclo. */
export function ProveedorDispositivos({ children }: { children: ReactNode }) {
  const valor = useCargaDispositivos()
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useDispositivos() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDispositivos tiene que usarse dentro de ProveedorDispositivos')
  return ctx
}
