import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { PastillaEstado } from '@/components/ui/PastillaEstado'
import { eliminarAlerta } from '@/services/consultas'
import { medida } from '@/utils/formato'
import type { Alerta } from '@/tipos'
import { condicionTexto, CondicionTexto } from './condicion'

export function FilaAlerta({
  alerta,
  unidad,
  puedeEditar,
  onEditar,
  onCambio,
}: {
  alerta: Alerta
  unidad: string
  puedeEditar: boolean
  onEditar: () => void
  onCambio: () => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  async function borrar() {
    setOcupado(true)
    try {
      await eliminarAlerta(alerta.id)
      setConfirmando(false)
      onCambio()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-label-lg font-medium text-text">
          {alerta.nombre || <CondicionTexto alerta={alerta} />}
          {alerta.estado === 'disparada' ? (
            <PastillaEstado estado="critico" etiqueta="Disparada" latiendo />
          ) : (
            <PastillaEstado estado="normal" />
          )}
          {!alerta.activa && <Pill tono="faint">Inactiva</Pill>}
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
            <Boton type="button" variante="texto" onClick={onEditar}>
              Editar
            </Boton>
            <Boton type="button" variante="destructivo" disabled={ocupado} onClick={() => setConfirmando(true)}>
              Borrar
            </Boton>
          </>
        )}
      </div>

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
