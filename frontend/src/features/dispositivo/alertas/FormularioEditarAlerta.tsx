import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { actualizarAlerta } from '@/lib/consultas'
import { mensajeDeError } from '@/lib/api'
import { esquemaAlertaEdicion, useFormulario } from '@/lib/formularios'
import type { AlertaConNotificar } from '@/lib/tipos'
import { ETIQUETA_CONDICION } from './condicion'

export function FormularioEditarAlerta({
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
