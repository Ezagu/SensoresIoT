import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { IconoMas } from '@/components/layout/iconos'
import type { EstadoDispositivo } from '@/utils/tiempo'
import type { Alerta } from '@/tipos'
import type { SensorConMeta } from './usarDispositivo'
import { FormularioNuevaAlerta } from './alertas/FormularioNuevaAlerta'
import { FormularioEditarAlerta } from './alertas/FormularioEditarAlerta'
import { FilaAlerta } from './alertas/FilaAlerta'

export function BloqueAlertas({
  sensores,
  alertas,
  conectividad,
  puedeAlertas,
  puedeEditar,
  maxAlertas,
  onCambio,
}: {
  sensores: SensorConMeta[]
  alertas: Alerta[]
  /* Ninguna regla de un equipo mudo se está evaluando: la fila lo dice. */
  conectividad: EstadoDispositivo
  puedeAlertas: boolean
  /* Rol de edición sobre el equipo. Un viewer ve las reglas y elige si quiere
     sus mails, pero no las crea, edita ni borra. */
  puedeEditar: boolean
  maxAlertas: number | null
  onCambio: () => void
}) {
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Alerta | null>(null)

  const etiquetaPorSensor = new Map(sensores.map((s) => [s.id, s] as const))
  const orden = new Map(sensores.map((s, i) => [s.id, i] as const))
  const ordenadas = [...alertas].sort(
    (a, b) =>
      Number(b.estado === 'disparada' && b.activa) - Number(a.estado === 'disparada' && a.activa) ||
      (orden.get(a.sensor_id) ?? 0) - (orden.get(b.sensor_id) ?? 0),
  )
  const alcanzoElMaximo = maxAlertas !== null && alertas.length >= maxAlertas

  function alCambiar() {
    onCambio()
    setCreando(false)
    setEditando(null)
  }

  return (
    <section aria-labelledby="titulo-alertas">
      <div className="flex min-h-10 items-center justify-between gap-4">
        <h2 id="titulo-alertas" className="text-heading-lg">
          Alertas
        </h2>
        {puedeAlertas && puedeEditar && (
          <Boton
            variante="sutil"
            onClick={() => setCreando(true)}
            disabled={sensores.length === 0 || alcanzoElMaximo}
            title={
              alcanzoElMaximo
                ? `Alcanzaste el límite de ${maxAlertas} reglas de este equipo`
                : undefined
            }
          >
            <IconoMas className="size-3.5" />
            Nueva regla
          </Boton>
        )}
      </div>

      {!puedeAlertas ? (
        <p className="mt-4 text-body text-text-muted">
          El plan de este equipo no incluye reglas de alerta.{' '}
          <Link to="/plan" className="font-medium text-accent hover:text-text">
            Ver planes
          </Link>
        </p>
      ) : alertas.length === 0 ? (
        <p className="mt-4 text-body text-text-muted">
          {puedeEditar
            ? 'Todavía no hay reglas. Creá una para que te avisemos cuando un sensor cruce un umbral.'
            : 'Todavía no hay reglas. Las crea quien administra el equipo.'}
        </p>
      ) : (
        <ul className="mt-2">
          {ordenadas.map((alerta) => {
            const sensor = etiquetaPorSensor.get(alerta.sensor_id)
            return (
              <FilaAlerta
                key={alerta.id}
                alerta={alerta}
                unidad={sensor?.unidad ?? ''}
                sensor={sensor?.etiqueta}
                conectividad={conectividad}
                puedeEditar={puedeEditar}
                onEditar={() => setEditando(alerta)}
                onCambio={onCambio}
              />
            )
          })}
        </ul>
      )}

      {puedeAlertas && maxAlertas !== null && alertas.length > 0 && (
        <p className="mt-4 text-body text-text-muted">
          {alcanzoElMaximo ? 'Usás' : 'Tenés'} {alertas.length} de {maxAlertas} reglas del plan de
          este equipo.{' '}
          {alcanzoElMaximo && (
            <Link to="/plan" className="font-medium text-accent hover:text-text">
              Sumar más con Premium
            </Link>
          )}
        </p>
      )}

      <Modal abierto={creando} onCerrar={() => setCreando(false)} titulo="Nueva alerta">
        <FormularioNuevaAlerta
          sensores={sensores}
          onCreada={alCambiar}
          onCancelar={() => setCreando(false)}
        />
      </Modal>

      <Modal abierto={editando !== null} onCerrar={() => setEditando(null)} titulo="Editar alerta">
        {editando && (
          <FormularioEditarAlerta
            alerta={editando}
            onGuardada={alCambiar}
            onCancelar={() => setEditando(null)}
          />
        )}
      </Modal>
    </section>
  )
}
