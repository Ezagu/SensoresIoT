import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Interruptor } from '@/components/ui/Interruptor'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { PastillaRegla } from '@/components/ui/PastillaEstado'
import { TextoError } from '@/components/ui/TextoError'
import { actualizarAlerta, eliminarAlerta } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { medida } from '@/utils/formato'
import type { EstadoDispositivo } from '@/utils/tiempo'
import type { Alerta } from '@/tipos'
import { condicionTexto, CondicionTexto } from './condicion'

export function FilaAlerta({
  alerta,
  unidad,
  conectividad,
  puedeEditar,
  onEditar,
  onCambio,
}: {
  alerta: Alerta
  unidad: string
  /* El estado de la regla depende de si el equipo está reportando: sin lecturas
     no se está evaluando nada. Mismo criterio que la lista global. */
  conectividad: EstadoDispositivo
  puedeEditar: boolean
  onEditar: () => void
  onCambio: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idTitulo = `alerta-${alerta.id}`

  /* Pausar es de un click y sin confirmación: es reversible con el mismo gesto,
     a diferencia de borrar. */
  async function alternar(activa: boolean) {
    setOcupado(true)
    setError(null)
    try {
      await actualizarAlerta(alerta.id, { activa })
      onCambio()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos cambiar el estado de la alerta.'))
    } finally {
      setOcupado(false)
    }
  }

  async function borrar() {
    setOcupado(true)
    setError(null)
    try {
      await eliminarAlerta(alerta.id)
      setConfirmando(false)
      onCambio()
    } catch (err) {
      setConfirmando(false)
      setError(mensajeDeError(err, 'No pudimos borrar la alerta.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          id={idTitulo}
          className="flex items-center gap-2 text-label-lg font-medium text-text"
        >
          {alerta.nombre || <CondicionTexto alerta={alerta} />}
          {/* Una regla pausada no tiene estado que informar: no se está evaluando. */}
          {alerta.activa ? (
            <PastillaRegla estado={alerta.estado} conectividad={conectividad} />
          ) : (
            <Pill tono="faint">Pausada</Pill>
          )}
        </span>
        <span className="text-note text-text-faint">
          {alerta.nombre && (
            <>
              <CondicionTexto alerta={alerta} /> ·{' '}
            </>
          )}
          {alerta.ultimo_valor !== null ? (
            <>
              Último: <span className="num">{medida(alerta.ultimo_valor, unidad)}</span>
            </>
          ) : (
            'Sin lecturas evaluadas'
          )}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {puedeEditar && (
          <>
            <Interruptor
              activo={alerta.activa}
              onCambiar={alternar}
              etiquetaId={idTitulo}
              disabled={ocupado}
            />
            <Boton type="button" variante="texto" onClick={onEditar}>
              Editar
            </Boton>
            <Boton type="button" variante="destructivo" disabled={ocupado} onClick={() => setConfirmando(true)}>
              Borrar
            </Boton>
          </>
        )}
      </div>

      {/* Un fallo tiene que quedar en la fila de la regla que falló: el bloque
          tiene varias y un aviso arriba no diría cuál. */}
      {error && (
        <div className="basis-full">
          <TextoError>{error}</TextoError>
        </div>
      )}

      {/* El <dialog> de la app y no window.confirm: el nativo no puede decir qué
          alerta se está por borrar cuando hay varias en la lista. */}
      {confirmando && (
        <Modal abierto onCerrar={() => setConfirmando(false)} titulo="Borrar alerta">
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
              Se borra <strong className="font-medium text-text">{alerta.nombre || condicionTexto(alerta)}</strong> y
              su historial de eventos deja de estar asociado a una regla. No se puede deshacer.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setConfirmando(false)}>
                Cancelar
              </Boton>
              <Boton type="button" disabled={ocupado} onClick={borrar}>
                {ocupado ? 'Borrando…' : 'Borrar alerta'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </li>
  )
}
