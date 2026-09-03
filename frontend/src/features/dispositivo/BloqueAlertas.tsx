import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Campo, Select } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { Vacio } from '@/components/ui/Vacio'
import { IconoMas } from '@/components/layout/iconos'
import { crearAlerta, actualizarAlerta, eliminarAlerta, actualizarPreferenciaAlerta } from '@/lib/consultas'
import { mensajeDeError } from '@/lib/api'
import { esquemaAlertaEdicion, esquemaAlertaNueva, useFormulario } from '@/lib/formularios'
import { agruparAlertasPorSensor } from '@/lib/alertas'
import { medida } from '@/lib/formato'
import type { AlertaConNotificar } from '@/lib/tipos'
import type { SensorConMeta } from './cargarSensores'

const ETIQUETA_CONDICION = { mayor: 'Mayor a', menor: 'Menor a' } as const

function condicionTexto(alerta: AlertaConNotificar) {
  return `${ETIQUETA_CONDICION[alerta.condicion]} ${alerta.umbral}`
}

// --------------------------------------------------------------------------
// Alta
// --------------------------------------------------------------------------

function FormularioNuevaAlerta({
  sensores,
  onCreada,
  onCancelar,
}: {
  sensores: SensorConMeta[]
  onCreada: () => void
  onCancelar: () => void
}) {
  const { campo, campoSelect, validar } = useFormulario(esquemaAlertaNueva, {
    sensorId: sensores[0]?.id ?? '',
    nombre: '',
    condicion: 'mayor',
    umbral: '',
    histeresis: '0',
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await crearAlerta({
        sensor_id: datos.sensorId,
        nombre: datos.nombre || null,
        condicion: datos.condicion,
        umbral: datos.umbral,
        histeresis: datos.histeresis,
      })
      onCreada()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos crear la alerta.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
      <Select etiqueta="Sensor" {...campoSelect('sensorId')}>
        {sensores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.etiqueta}
          </option>
        ))}
      </Select>
      <Campo etiqueta="Nombre (opcional)" placeholder="Ej: Temperatura alta" {...campo('nombre')} />
      <div className="grid grid-cols-2 gap-3">
        <Select etiqueta="Condición" {...campoSelect('condicion')}>
          <option value="mayor">Mayor a</option>
          <option value="menor">Menor a</option>
        </Select>
        <Campo etiqueta="Umbral" type="number" step="any" inputMode="decimal" {...campo('umbral')} />
      </div>
      <Campo
        etiqueta="Histéresis"
        type="number"
        step="any"
        min={0}
        inputMode="decimal"
        ayuda="Margen antes de volver a 'normal', para que no oscile en el límite."
        {...campo('histeresis')}
      />

      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <Boton type="button" variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear alerta'}
        </Boton>
      </div>
    </form>
  )
}

// --------------------------------------------------------------------------
// Edición
// --------------------------------------------------------------------------

function FormularioEditarAlerta({
  alerta,
  onGuardada,
  onCancelar,
}: {
  alerta: AlertaConNotificar
  onGuardada: () => void
  onCancelar: () => void
}) {
  const { campo, validar } = useFormulario(esquemaAlertaEdicion, {
    nombre: alerta.nombre ?? '',
    umbral: String(alerta.umbral),
    histeresis: String(alerta.histeresis),
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await actualizarAlerta(alerta.id, {
        nombre: datos.nombre || null,
        umbral: datos.umbral,
        histeresis: datos.histeresis,
      })
      onGuardada()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos guardar los cambios.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
      <p className="text-note-lg text-text-faint">
        {ETIQUETA_CONDICION[alerta.condicion]} — para cambiar la condición, creá otra regla.
      </p>
      <Campo etiqueta="Nombre (opcional)" {...campo('nombre')} />
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Umbral" type="number" step="any" inputMode="decimal" {...campo('umbral')} />
        <Campo etiqueta="Histéresis" type="number" step="any" min={0} inputMode="decimal" {...campo('histeresis')} />
      </div>

      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <Boton type="button" variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </form>
  )
}

// --------------------------------------------------------------------------
// Fila
// --------------------------------------------------------------------------

function FilaAlerta({
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

// --------------------------------------------------------------------------
// Bloque
// --------------------------------------------------------------------------

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
