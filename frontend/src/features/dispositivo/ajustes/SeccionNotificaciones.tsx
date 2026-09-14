import { useState } from 'react'
import { Segmentado } from '@/components/ui/Segmentado'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { configurarNotificaciones } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import type { DispositivoDetalle } from '@/tipos'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'

type Opcion = 'si' | 'no'

const OPCIONES: { valor: Opcion; etiqueta: string }[] = [
  { valor: 'si', etiqueta: 'Activadas' },
  { valor: 'no', etiqueta: 'Silenciadas' },
]

/* Habilitada para todos los roles a propósito, viewer incluido: es el opt-out
   de mails de cada uno, no una edición del equipo. */
export function SeccionNotificaciones({
  dispositivo,
  onGuardado,
}: {
  dispositivo: DispositivoDetalle
  onGuardado: () => void
}) {
  // Optimista: el radio tiene que responder al click, no al round-trip.
  const [valor, setValor] = useState<Opcion>(dispositivo.notificar ? 'si' : 'no')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cambiar(nuevo: Opcion) {
    const anterior = valor
    setValor(nuevo)
    setOcupado(true)
    setError(null)
    try {
      await configurarNotificaciones(dispositivo.id, { notificar: nuevo === 'si' })
      onGuardado()
    } catch (err) {
      setValor(anterior)
      setError(mensajeDeError(err, 'No pudimos actualizar tus notificaciones.'))
    } finally {
      setOcupado(false)
    }
  }

  // Un admin no tiene vínculo con el equipo, así que tampoco es destinatario:
  // el control no tendría sobre qué operar.
  if (dispositivo.notificar === null) return null

  return (
    <SeccionAjustes
      titulo="Mis notificaciones"
      descripcion="Los mails de alerta que te llegan por este equipo."
    >
      {dispositivo.limites.puede_alertas ? (
        <Segmentado
          valor={valor}
          opciones={OPCIONES}
          onCambiar={cambiar}
          etiqueta="Notificaciones de este equipo"
          disabled={ocupado}
        />
      ) : (
        <Vacio titulo="Este equipo no tiene alertas habilitadas en su plan" />
      )}

      {error && <TextoError>{error}</TextoError>}
    </SeccionAjustes>
  )
}
