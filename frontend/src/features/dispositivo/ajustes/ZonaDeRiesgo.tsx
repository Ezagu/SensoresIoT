import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { TextoError } from '@/components/ui/TextoError'
import { quitarAcceso } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import type { DispositivoDetalle } from '@/tipos'
import { ZonaPeligro } from '@/components/ui/SeccionAjustes'

export function ZonaDeRiesgo({
  id,
  dispositivo,
  esDuenio,
  usuarioActualId,
}: {
  id: string
  dispositivo: DispositivoDetalle
  esDuenio: boolean
  usuarioActualId: string
}) {
  const navigate = useNavigate()
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null)

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
    <ZonaPeligro
      id={id}
      titulo="Desvincular este equipo"
      accion={
        <>
          <Boton variante="peligro" disabled={esDuenio} onClick={() => setConfirmandoQuitar(true)}>
            Desvincular
          </Boton>
          {errorQuitar && <TextoError>{errorQuitar}</TextoError>}
        </>
      }
    >
      {esDuenio
        ? 'Como dueño, primero tenés que quitar el acceso de las demás personas en "Acceso". Las mediciones no se borran.'
        : 'Dejás de verlo y de recibir sus avisos. Las mediciones no se borran: el equipo sigue midiendo y guardando.'}
      {confirmandoQuitar && (
        <Modal abierto onCerrar={() => setConfirmandoQuitar(false)} titulo="Desvincular equipo">
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
              Dejás de ver{' '}
              <strong className="font-medium text-text">
                {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
              </strong>{' '}
              en tu panel. El equipo sigue midiendo y guardando.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setConfirmandoQuitar(false)}>
                Cancelar
              </Boton>
              <Boton type="button" disabled={quitando} onClick={quitarDeMiCuenta}>
                {quitando ? 'Desvinculando…' : 'Desvincular'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </ZonaPeligro>
  )
}
