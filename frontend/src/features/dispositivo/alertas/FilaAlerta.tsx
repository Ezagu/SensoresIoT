import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { MarcaEstado, type Estado } from '@/components/ui/MarcaEstado'
import { MenuAcciones } from '@/components/ui/MenuAcciones'
import { TextoError } from '@/components/ui/TextoError'
import { actualizarAlerta, eliminarAlerta } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { medida, numero } from '@/utils/formato'
import type { EstadoDispositivo } from '@/utils/tiempo'
import type { Alerta } from '@/tipos'
import { condicionTexto, CondicionTexto, SIMBOLO_CONDICION } from './condicion'

export function FilaAlerta({
  alerta,
  unidad,
  sensor,
  conectividad,
  puedeEditar,
  onEditar,
  onCambio,
}: {
  alerta: Alerta
  unidad: string
  /* Etiqueta del sensor: título de una regla sin nombre, prefijo de una con nombre. */
  sensor?: string
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

  const estado: { glifo: Estado; texto: string; clase: string } = !alerta.activa
    ? { glifo: 'inactivo', texto: 'Pausada', clase: 'text-text-faint' }
    : alerta.estado === 'disparada'
      ? { glifo: 'critico', texto: 'Disparada', clase: 'font-semibold text-danger' }
      : conectividad === 'nunca' || conectividad === 'sin-reportar'
        ? {
            glifo: conectividad === 'nunca' ? 'sin-datos' : 'sin-reportar',
            texto: 'Sin evaluar',
            clase: 'text-text-muted',
          }
        : { glifo: 'normal', texto: 'Normal', clase: 'text-text-muted' }

  return (
    <li className="grid grid-cols-[1.125rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3.5">
      <MarcaEstado estado={estado.glifo} latiendo />
      <div className="min-w-0">
        <p id={idTitulo} className="truncate text-body-lg font-medium text-text">
          {alerta.nombre || sensor || <CondicionTexto alerta={alerta} unidad={unidad} />}
        </p>
        <p className="num mt-0.5 truncate text-note-lg font-normal tracking-normal text-text-muted">
          {alerta.nombre && sensor && `${sensor} `}
          {SIMBOLO_CONDICION[alerta.condicion]} {medida(alerta.umbral, unidad)} · histéresis{' '}
          {numero(alerta.histeresis)} · {alerta.muestras_confirmacion}{' '}
          {alerta.muestras_confirmacion === 1 ? 'lectura' : 'lecturas'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-note-lg ${estado.clase}`}>{estado.texto}</span>
        {puedeEditar && (
          <MenuAcciones
            etiqueta={`Acciones de ${alerta.nombre || condicionTexto(alerta)}`}
            acciones={[
              { etiqueta: 'Editar', onElegir: onEditar },
              {
                etiqueta: alerta.activa ? 'Pausar' : 'Reanudar',
                onElegir: () => alternar(!alerta.activa),
                disabled: ocupado,
              },
              {
                etiqueta: 'Borrar',
                onElegir: () => setConfirmando(true),
                peligrosa: true,
                disabled: ocupado,
              },
            ]}
          />
        )}
      </div>

      {/* Un fallo tiene que quedar en la fila de la regla que falló: el bloque
          tiene varias y un aviso arriba no diría cuál. */}
      {error && (
        <div className="col-span-full">
          <TextoError>{error}</TextoError>
        </div>
      )}

      {/* El <dialog> de la app y no window.confirm: el nativo no puede decir qué
          alerta se está por borrar cuando hay varias en la lista. */}
      {confirmando && (
        <Modal abierto onCerrar={() => setConfirmando(false)} titulo="Borrar alerta">
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
              Se borra{' '}
              <strong className="font-medium text-text">
                {alerta.nombre || condicionTexto(alerta)}
              </strong>{' '}
              y el equipo deja de evaluarla. Lo que ya avisó queda en el registro, con el umbral que
              tenía cuando disparó. No se puede deshacer.
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
