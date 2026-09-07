import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Pill } from '@/components/ui/Pill'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { actualizarPreferenciaAlerta } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import type { AlertaConNotificar } from '@/tipos'
import { SeccionAjustes } from './SeccionAjustes'

/* Preferencia POR USUARIO, habilitada para todos los roles a propósito: es el
   opt-out de mails de cada uno, no una edición de la regla (igual que
   "Notificándome" en FilaAlerta, que esto compone sobre todas a la vez). */
export function SeccionNotificaciones({
  alertas,
  puedeAlertas,
  onCambio,
}: {
  alertas: AlertaConNotificar[]
  puedeAlertas: boolean
  onCambio: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = alertas.length
  const activas = alertas.filter((a) => a.notificar).length

  async function cambiarTodas(notificar: boolean) {
    setOcupado(true)
    setError(null)
    try {
      await Promise.all(
        alertas
          .filter((a) => a.notificar !== notificar)
          .map((a) => actualizarPreferenciaAlerta(a.id, { notificar })),
      )
      onCambio()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos actualizar tus notificaciones.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <SeccionAjustes
      titulo="Mis notificaciones"
      descripcion="Los mails de alerta que te llegan por este equipo. No afecta a los demás usuarios con acceso."
    >
      {!puedeAlertas ? (
        <Vacio titulo="Este equipo no tiene alertas habilitadas en su plan" />
      ) : total === 0 ? (
        <Vacio titulo="Todavía no hay alertas configuradas" detalle="Se crean desde el detalle del equipo." />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {activas === total ? (
            <Pill tono="ok">Todas activas</Pill>
          ) : activas === 0 ? (
            <Pill tono="faint">Todas silenciadas</Pill>
          ) : (
            <Pill tono="faint">{`${activas} de ${total} activas`}</Pill>
          )}
          <div className="flex gap-2">
            <Boton variante="fantasma" disabled={ocupado || activas === total} onClick={() => cambiarTodas(true)}>
              Activar todas
            </Boton>
            <Boton variante="fantasma" disabled={ocupado || activas === 0} onClick={() => cambiarTodas(false)}>
              Silenciar todas
            </Boton>
          </div>
        </div>
      )}

      {error && <TextoError>{error}</TextoError>}
    </SeccionAjustes>
  )
}
