import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo, Select } from '@/components/ui/Campo'
import { crearAlerta } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { esquemaAlertaNueva } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'
import type { SensorConMeta } from '../usarDispositivo'
import { TextoError } from '@/components/ui/TextoError'

export function FormularioNuevaAlerta({
  sensores,
  onCreada,
  onCancelar,
}: {
  sensores: SensorConMeta[]
  onCreada: () => void
  onCancelar: () => void
}) {
  const { campo, validar } = useFormulario(esquemaAlertaNueva, {
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
      <Select etiqueta="Sensor" {...campo('sensorId')}>
        {sensores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.etiqueta}
          </option>
        ))}
      </Select>
      <Campo etiqueta="Nombre (opcional)" placeholder="Ej: Temperatura alta" {...campo('nombre')} />
      <div className="grid grid-cols-2 gap-3">
        <Select etiqueta="Condición" {...campo('condicion')}>
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
        <TextoError>
          {error}
        </TextoError>
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
