import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { BotonCopiar } from '@/components/ui/BotonCopiar'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { TextoError } from '@/components/ui/TextoError'
import { IconoActualizar, IconoEnlace, IconoSobre } from '@/components/layout/iconos'
import { eliminarInvitacion, regenerarInvitacion } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { ETIQUETA_ROL } from '@/utils/dispositivos'
import { fecha } from '@/utils/tiempo'
import { COOLDOWN_REGENERAR_MS, esLinkGlobal, estaVencida, linkDeInvitacion } from '@/utils/invitaciones'
import type { Invitacion } from '@/tipos'
import { useCooldown } from './usarCooldown'

function restanteLegible(ms: number): string {
  const seg = Math.ceil(ms / 1000)
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type Accion = 'eliminar' | 'regenerar'

/* Una invitación cualquiera: la columna de identidad cambia según el email
   sea null (link global) o no (invitación dirigida), pero copiar, eliminar,
   regenerar y la etiqueta de vencimiento son la misma lógica en los dos casos. */
export function FilaInvitacion({
  dispositivoId,
  invitacion,
  puedeGestionar,
  onCambio,
}: {
  dispositivoId: string
  invitacion: Invitacion
  puedeGestionar: boolean
  onCambio: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState<Accion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const global = esLinkGlobal(invitacion)
  const vencida = estaVencida(invitacion)
  const restante = useCooldown(invitacion.regenerado_at, COOLDOWN_REGENERAR_MS)
  const link = linkDeInvitacion(dispositivoId, invitacion.token)
  const etiquetaRol = ETIQUETA_ROL[invitacion.rol]
  const accion = global ? 'Regenerar link' : 'Reenviar invitación'
  const accionEnCurso = global ? 'Regenerando…' : 'Reenviando…'

  /* Reenviar y regenerar son la misma operación: no existe reenviar con el
     token viejo, se emite uno nuevo (y más adelante, el mail sale con ése).
     A diferencia de eliminar, la fila sobrevive —el id se conserva—, así que
     hay que cerrar el modal a mano. */
  async function regenerar() {
    setOcupado(true)
    setError(null)
    try {
      await regenerarInvitacion(dispositivoId, invitacion.id)
      setConfirmando(null)
      onCambio()
    } catch (err) {
      setError(mensajeDeError(err, global ? 'No pudimos regenerar el link.' : 'No pudimos reenviar la invitación.'))
      setConfirmando(null)
    } finally {
      setOcupado(false)
    }
  }

  async function eliminar() {
    setOcupado(true)
    setError(null)
    try {
      await eliminarInvitacion(dispositivoId, invitacion.id)
      onCambio()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos eliminar la invitación.'))
      setConfirmando(null)
      setOcupado(false)
    }
  }

  return (
    <li className="py-2.5">
      {/* El ícono es una canaleta: identidad y acciones comparten la misma
          columna, así abajo de sm las acciones caen alineadas con el texto que
          operan y no contra el borde del <li>. */}
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-7.5 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-muted"
        >
          {global ? <IconoEnlace className="size-3.75" /> : <IconoSobre className="size-3.75" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-2 text-label-lg font-medium text-text">
              <span className="truncate">{global ? etiquetaRol : invitacion.email}</span>
              {!global && <Pill tono="faint">{etiquetaRol}</Pill>}
              {vencida && <Pill tono="warn">Vencido</Pill>}
            </span>
            {/* A 390px la URL visible es sólo el prefijo: no se puede leer ni
                verificar, y el afford real es Copiar. Vuelve en sm. */}
            {global && <span className="font-mono hidden truncate text-note text-text-faint sm:block">{link}</span>}
            <span className="text-note text-text-faint">
              {vencida ? 'Venció el ' : 'Vence el '}
              <span className="num">{fecha(invitacion.expires_at)}</span>
            </span>
          </div>

          {puedeGestionar && (
            <div className="-ml-2 flex flex-wrap items-center gap-0.5 sm:ml-0 sm:shrink-0 sm:gap-1">
              <BotonCopiar
                texto={link}
                etiqueta={
                  global ? `Copiar link de ${etiquetaRol.toLowerCase()}` : `Copiar link para ${invitacion.email}`
                }
              />
              <Boton
                type="button"
                variante="texto"
                disabled={ocupado || restante > 0}
                onClick={() => setConfirmando('regenerar')}
                title={restante > 0 ? `Disponible en ${restanteLegible(restante)}` : undefined}
              >
                {global ? <IconoActualizar className="size-3.5" /> : <IconoSobre className="size-3.5" />}
                {restante > 0 ? <span className="num">{restanteLegible(restante)}</span> : global ? 'Regenerar' : 'Reenviar'}
              </Boton>
              <Boton
                type="button"
                variante="destructivo"
                disabled={ocupado}
                onClick={() => setConfirmando('eliminar')}
              >
                Eliminar
              </Boton>
            </div>
          )}
        </div>
      </div>

      {error && <TextoError className="mt-1.5 pl-10">{error}</TextoError>}

      {confirmando === 'eliminar' && (
        <Modal abierto onCerrar={() => setConfirmando(null)} titulo="Eliminar invitación">
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
              {global ? (
                <>
                  El link de <strong className="font-medium text-text">{etiquetaRol.toLowerCase()}</strong> deja de
                  funcionar. Nadie más va a poder entrar con él.
                </>
              ) : (
                <>
                  La invitación a <strong className="font-medium text-text">{invitacion.email}</strong> se cancela.
                  Podés volver a invitarla cuando quieras.
                </>
              )}
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setConfirmando(null)}>
                Cancelar
              </Boton>
              <Boton type="button" disabled={ocupado} onClick={eliminar}>
                {ocupado ? 'Eliminando…' : 'Eliminar invitación'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}

      {confirmando === 'regenerar' && (
        <Modal
          abierto
          onCerrar={() => setConfirmando(null)}
          titulo={accion}
        >
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
              {global ? (
                <>
                  El link de <strong className="font-medium text-text">{etiquetaRol.toLowerCase()}</strong> que ya
                  repartiste deja de funcionar y se reemplaza por uno nuevo.
                </>
              ) : (
                <>
                  Se emite una invitación nueva para{' '}
                  <strong className="font-medium text-text">{invitacion.email}</strong> y el link anterior deja de
                  valer. El mail todavía no sale solo: copiá el link nuevo y mandáselo vos.
                </>
              )}
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setConfirmando(null)}>
                Cancelar
              </Boton>
              <Boton type="button" disabled={ocupado} onClick={regenerar}>
                {ocupado ? accionEnCurso : accion}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </li>
  )
}
