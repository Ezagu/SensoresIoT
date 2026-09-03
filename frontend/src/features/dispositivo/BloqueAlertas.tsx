import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { Vacio } from '@/components/ui/Vacio'
import { IconoMas } from '@/components/layout/iconos'
import { agruparAlertasPorSensor } from '@/lib/alertas'
import type { AlertaConNotificar } from '@/lib/tipos'
import type { SensorConMeta } from './cargarSensores'
import { FormularioNuevaAlerta } from './alertas/FormularioNuevaAlerta'
import { FormularioEditarAlerta } from './alertas/FormularioEditarAlerta'
import { FilaAlerta } from './alertas/FilaAlerta'

export function BloqueAlertas({
  sensores,
  alertas,
  puedeAlertas,
  maxAlertas,
  onCambio,
}: {
  sensores: SensorConMeta[]
  alertas: AlertaConNotificar[]
  puedeAlertas: boolean
  maxAlertas: number | null
  onCambio: () => void
}) {
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<AlertaConNotificar | null>(null)

  const porSensor = agruparAlertasPorSensor(alertas)
  const unidadPorSensor = new Map(sensores.map((s) => [s.id, s.unidad] as const))
  const alcanzoElMaximo = maxAlertas !== null && alertas.length >= maxAlertas

  function alCambiar() {
    onCambio()
    setCreando(false)
    setEditando(null)
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading font-semibold">Alertas</h2>
        {puedeAlertas ? (
          <Boton
            variante="sutil"
            onClick={() => setCreando(true)}
            disabled={sensores.length === 0 || alcanzoElMaximo}
            title={alcanzoElMaximo ? `Alcanzaste el límite de ${maxAlertas} alertas de este dispositivo` : undefined}
          >
            <IconoMas className="size-3.5" />
            Nueva
          </Boton>
        ) : null}
      </div>

      {!puedeAlertas ? (
        <Vacio
          titulo="Las alertas son premium"
          detalle="Este dispositivo no tiene alertas habilitadas en su plan."
          accion={
            <Link to="/plan">
              <Boton variante="sutil">Ver planes</Boton>
            </Link>
          }
        />
      ) : alertas.length === 0 ? (
        <Vacio
          titulo="Sin alertas configuradas"
          detalle="Creá una regla para que te avisemos cuando un sensor cruce un umbral."
        />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {sensores
            .filter((s) => (porSensor.get(s.id) ?? []).length > 0)
            .map((sensor) => (
              <div key={sensor.id} className="py-1 first:pt-0">
                <p className="flex items-center gap-1.5 pt-1.5 text-note font-medium tracking-wide text-text-faint uppercase">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{ background: sensor.color }}
                  />
                  {sensor.etiqueta}
                </p>
                <ul className="flex flex-col divide-y divide-border">
                  {(porSensor.get(sensor.id) ?? []).map((alerta) => (
                    <FilaAlerta
                      key={alerta.id}
                      alerta={alerta}
                      unidad={unidadPorSensor.get(alerta.sensor_id) ?? ''}
                      onEditar={() => setEditando(alerta)}
                      onCambio={onCambio}
                    />
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      <Modal abierto={creando} onCerrar={() => setCreando(false)} titulo="Nueva alerta">
        <FormularioNuevaAlerta sensores={sensores} onCreada={alCambiar} onCancelar={() => setCreando(false)} />
      </Modal>

      <Modal abierto={editando !== null} onCerrar={() => setEditando(null)} titulo="Editar alerta">
        {editando && (
          <FormularioEditarAlerta alerta={editando} onGuardada={alCambiar} onCancelar={() => setEditando(null)} />
        )}
      </Modal>
    </Card>
  )
}
