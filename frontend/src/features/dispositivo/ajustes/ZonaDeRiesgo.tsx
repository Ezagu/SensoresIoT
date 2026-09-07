import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { TextoError } from '@/components/ui/TextoError'
import { actualizarDispositivo, quitarAcceso } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import type { DispositivoDetalle } from '@/tipos'
import { SeccionAjustes } from './SeccionAjustes'

export function ZonaDeRiesgo({
  dispositivo,
  esDuenio,
  usuarioActualId,
  onCambio,
}: {
  dispositivo: DispositivoDetalle
  esDuenio: boolean
  usuarioActualId: string
  onCambio: () => void
}) {
  const navigate = useNavigate()
  const [pausando, setPausando] = useState(false)
  const [errorPausa, setErrorPausa] = useState<string | null>(null)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null)

  async function alternarPausa() {
    setPausando(true)
    setErrorPausa(null)
    try {
      await actualizarDispositivo(dispositivo.id, { activo: !dispositivo.activo })
      onCambio()
    } catch (err) {
      setErrorPausa(mensajeDeError(err, 'No pudimos cambiar el estado.'))
    } finally {
      setPausando(false)
    }
  }

  async function quitarDeMiCuenta() {
    setQuitando(true)
    setErrorQuitar(null)
    try {
      await quitarAcceso(dispositivo.id, usuarioActualId)
      navigate('/')
    } catch (err) {
      setErrorQuitar(mensajeDeError(err, 'No pudimos quitar el equipo de tu cuenta.'))
      setQuitando(false)
    }
  }

  return (
    <SeccionAjustes titulo="Zona de riesgo">
      <div className="flex flex-col divide-y divide-border">
        {esDuenio && (
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
            <div>
              <p className="text-label-lg font-medium text-text">
                {dispositivo.activo ? 'Pausar el equipo' : 'Reactivar el equipo'}
              </p>
              <p className="text-note text-text-faint">
                {dispositivo.activo
                  ? 'Deja de contarse como en línea y no aparece entre tus equipos con problemas. Sigue midiendo y guardando.'
                  : 'Vuelve a contarse como un equipo activo en el panel.'}
              </p>
            </div>
            <Boton variante="fantasma" disabled={pausando} onClick={alternarPausa}>
              {pausando ? 'Guardando…' : dispositivo.activo ? 'Pausar' : 'Reactivar'}
            </Boton>
          </div>
        )}
        {errorPausa && <TextoError className="py-1">{errorPausa}</TextoError>}

        <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
          <div>
            <p className="text-label-lg font-medium text-text">Quitar de mi cuenta</p>
            <p className="text-note text-text-faint">
              {esDuenio
                ? 'Como dueño, primero tenés que quitar el acceso de las demás personas en "Acceso compartido".'
                : 'Perdés acceso a sus datos. El equipo sigue midiendo y guardando; se puede volver a vincular con su código.'}
            </p>
          </div>
          <Boton variante="destructivo" disabled={esDuenio} onClick={() => setConfirmandoQuitar(true)}>
            Quitar
          </Boton>
        </div>
        {errorQuitar && <TextoError className="py-1">{errorQuitar}</TextoError>}
      </div>

      {confirmandoQuitar && (
        <Modal abierto onCerrar={() => setConfirmandoQuitar(false)} titulo="Quitar equipo de mi cuenta">
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
              Dejás de ver{' '}
              <strong className="font-medium text-text">
                {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
              </strong>{' '}
              en tu panel. El equipo sigue midiendo y guardando; podés volver a vincularlo con su código si cambiás
              de opinión.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setConfirmandoQuitar(false)}>
                Cancelar
              </Boton>
              <Boton type="button" disabled={quitando} onClick={quitarDeMiCuenta}>
                {quitando ? 'Quitando…' : 'Quitar equipo'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </SeccionAjustes>
  )
}
