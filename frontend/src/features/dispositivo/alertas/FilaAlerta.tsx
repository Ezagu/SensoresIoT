import { useState } from 'react'
import { Pill } from '@/components/ui/Pill'
import { eliminarAlerta, actualizarPreferenciaAlerta } from '@/lib/consultas'
import { medida } from '@/lib/formato'
import type { AlertaConNotificar } from '@/lib/tipos'
import { condicionTexto } from './condicion'

export function FilaAlerta({
  alerta,
  unidad,
  onEditar,
  onCambio,
}: {
  alerta: AlertaConNotificar
  unidad: string
  onEditar: () => void
  onCambio: () => void
}) {
  const [ocupado, setOcupado] = useState(false)

  async function alternarNotificar() {
    setOcupado(true)
    try {
      await actualizarPreferenciaAlerta(alerta.id, { notificar: !alerta.notificar })
      onCambio()
    } finally {
      setOcupado(false)
    }
  }

  async function borrar() {
    if (!window.confirm('¿Borrar esta alerta? No se puede deshacer.')) return
    setOcupado(true)
    try {
      await eliminarAlerta(alerta.id)
      onCambio()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-label-lg font-medium text-text">
          {alerta.nombre || condicionTexto(alerta)}
          <Pill tono={alerta.estado === 'disparada' ? 'danger' : 'ok'}>
            {alerta.estado === 'disparada' ? 'Disparada' : 'Normal'}
          </Pill>
          {!alerta.activa && <Pill tono="faint">Inactiva</Pill>}
        </span>
        <span className="text-note text-text-faint">
          {alerta.nombre && `${condicionTexto(alerta)} · `}
          {alerta.ultimo_valor !== null ? `Último: ${medida(alerta.ultimo_valor, unidad)}` : 'Sin lecturas evaluadas'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={ocupado}
          onClick={alternarNotificar}
          className="rounded-tile px-2 py-1 text-note font-medium text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50 cursor-pointer"
          title="Sólo afecta tus propias notificaciones, no las de los demás usuarios con acceso"
        >
          {alerta.notificar ? 'Notificándome' : 'Sin notificar'}
        </button>
        <button
          type="button"
          onClick={onEditar}
          className="rounded-tile px-2 py-1 text-note font-medium text-accent hover:bg-accent-soft cursor-pointer"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={borrar}
          className="rounded-tile px-2 py-1 text-note font-medium text-danger hover:bg-danger-soft disabled:opacity-50 cursor-pointer"
        >
          Borrar
        </button>
      </div>
    </li>
  )
}
