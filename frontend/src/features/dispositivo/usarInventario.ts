import { useCallback, useState } from 'react'
import { useSesion } from '@/features/auth/sesion'
import { listarDispositivos } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'
import type { DispositivoConRol, DispositivoInventario } from '@/tipos'

/* El endpoint todavía devuelve DispositivoConRolOut pelado: los campos de
   inventario llegan undefined. Sin completarlos la fila revienta al mapear
   sensores. Se borra entero cuando el backend esté enriquecido. */
type InventarioCrudo = DispositivoConRol & Partial<DispositivoInventario>

/* `enriquecido` distingue "no tiene reglas" de "el campo no vino". Sin eso la
   pantalla afirmaría "sin reglas" sobre todos los equipos, que es mentira, no
   un vacío. Desaparece junto con el resto de este shim. */
export type EquipoInventario = DispositivoInventario & { enriquecido: boolean }

function completar(crudo: InventarioCrudo): EquipoInventario {
  return {
    ...crudo,
    enriquecido: crudo.sensores !== undefined,
    owner_nombre: crudo.owner_nombre ?? null,
    sensores: crudo.sensores ?? [],
    alertas_total: crudo.alertas_total ?? 0,
    alertas_disparadas: crudo.alertas_disparadas ?? 0,
    accesos_total: crudo.accesos_total ?? 0,
  }
}

/* Toda la flota como equipos, sin lecturas. La cadencia sale del resultado
   (el intervalo mínimo de la cartera), mismo criterio que features/panel. */
export function useInventario() {
  const { sesion } = useSesion()
  const usuarioId = sesion?.usuario_id
  const [cadenciaSeg, setCadenciaSeg] = useState<number>()

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<EquipoInventario[]> => {
      if (!usuarioId) return []
      const crudos = await listarDispositivos(usuarioId, signal)
      return crudos.map(completar)
    },
    [usuarioId],
  )

  const estado = useCarga(cargar, {
    intervaloMs: cadenciaSeg !== undefined ? cadenciaSeg * 1000 : undefined,
  })

  // Derivado en el render y no en un efecto: la cadencia real recién se conoce
  // con la primera respuesta. Number.isFinite no es defensa de más: un NaN acá
  // nunca es igual a sí mismo y este setState no convergería jamás.
  const menor = estado.datos?.length
    ? Math.min(...estado.datos.map((d) => d.intervalo_efectivo_seg))
    : undefined
  if (menor !== undefined && Number.isFinite(menor) && menor !== cadenciaSeg) setCadenciaSeg(menor)

  return { ...estado, cadenciaSeg }
}
