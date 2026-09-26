import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { Select } from '@/components/ui/Select'
import { TextoError } from '@/components/ui/TextoError'
import { iniciales } from '@/components/layout/MenuCuenta'
import { actualizarAcceso, quitarAcceso } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { ETIQUETA_ROL } from '@/utils/dispositivos'
import type { AccesoDispositivo, RolCompartido } from '@/tipos'

export function FilaAcceso({
  dispositivoId,
  acceso,
  esUsuarioActual,
  puedeGestionar,
  onCambio,
}: {
  dispositivoId: string
  acceso: AccesoDispositivo
  esUsuarioActual: boolean
  /* Sólo el dueño gestiona a un tercero: un editor ve la lista pero no la toca. */
  puedeGestionar: boolean
  onCambio: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const esDueño = acceso.rol === 'owner'

  async function cambiarRol(rol: RolCompartido) {
    setOcupado(true)
    setError(null)
    try {
      await actualizarAcceso(dispositivoId, acceso.usuario_id, { rol })
      onCambio()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos cambiar el rol.'))
    } finally {
      setOcupado(false)
    }
  }

  async function quitar() {
    setOcupado(true)
    try {
      await quitarAcceso(dispositivoId, acceso.usuario_id)
      onCambio()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos quitar el acceso.'))
      setConfirmando(false)
      setOcupado(false)
    }
  }

  return (
    <li className="py-2.5">
      {/* Los controles son compactos y entran al lado del nombre aun a 390px:
          esta fila no se parte, sólo mantiene al avatar como canaleta. */}
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-7.5 shrink-0 items-center justify-center rounded-control border border-border bg-surface-2 font-display text-label-lg font-bold text-text"
        >
          {iniciales(acceso.nombre)}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label-lg font-medium text-text">
              {acceso.nombre}
              {esUsuarioActual && <span className="font-normal text-text-faint"> (vos)</span>}
            </span>
            <span className="truncate text-note text-text-faint">{acceso.email}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {esDueño ? (
              <Pill tono="faint">Dueño</Pill>
            ) : puedeGestionar ? (
              <>
                <Select
                  id={`rol-${acceso.usuario_id}`}
                  etiqueta={`Rol de ${acceso.nombre}`}
                  etiquetaOculta
                  tamaño="compacto"
                  value={acceso.rol}
                  disabled={ocupado}
                  onChange={(e) => cambiarRol(e.target.value as RolCompartido)}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Solo lectura</option>
                </Select>
                <Boton type="button" variante="destructivo" disabled={ocupado} onClick={() => setConfirmando(true)}>
                  Quitar
                </Boton>
              </>
            ) : (
              <Pill tono="faint">{ETIQUETA_ROL[acceso.rol]}</Pill>
            )}
          </div>
        </div>
      </div>

      {error && <TextoError className="mt-1.5 pl-10">{error}</TextoError>}

      {confirmando && (
        <Modal abierto onCerrar={() => setConfirmando(false)} titulo="Quitar acceso">
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
              <strong className="font-medium text-text">{acceso.nombre}</strong> pierde acceso a este equipo. Se
              lo puede volver a invitar cuando quieras.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setConfirmando(false)}>
                Cancelar
              </Boton>
              <Boton type="button" disabled={ocupado} onClick={quitar}>
                {ocupado ? 'Quitando…' : 'Quitar acceso'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </li>
  )
}
