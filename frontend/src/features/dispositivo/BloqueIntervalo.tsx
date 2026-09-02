import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { configurarIntervalo } from '@/lib/consultas'
import { mensajeDeError } from '@/lib/api'
import { esquemaIntervalo, useFormulario } from '@/lib/formularios'

export function BloqueIntervalo({
  dispositivoId,
  intervaloConfigurado,
  pisoPlan,
  abierto,
  onCerrar,
  onGuardado,
}: {
  dispositivoId: string
  intervaloConfigurado: number | null
  pisoPlan: number | undefined
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [automatico, setAutomatico] = useState(intervaloConfigurado === null)
  const { campo, validar, errores } = useFormulario(esquemaIntervalo, {
    intervaloSeg: String(intervaloConfigurado ?? pisoPlan ?? 60),
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    let valor: number | null = null
    if (!automatico) {
      const datos = validar()
      if (!datos) return
      valor = datos.intervaloSeg
    }

    setEnviando(true)
    try {
      await configurarIntervalo(dispositivoId, valor)
      onGuardado()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos guardar el intervalo.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Intervalo de muestreo">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <p className="text-note-lg text-text-faint">
          El dispositivo aplica el cambio en su próxima conexión, no al instante.
        </p>

        <Campo
          etiqueta="Intervalo (segundos)"
          type="number"
          min={pisoPlan}
          {...campo('intervaloSeg')}
          disabled={automatico}
          {...(automatico && {
            /* En automático el que rige es el piso del plan, no el último valor
               tipeado: mostrarlo deshabilitado sin corregirlo sería mentir. */
            value: String(pisoPlan ?? ''),
          })}
        />
        
        <label className="flex items-center gap-2 text-label text-text-muted">
          <input type="checkbox" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} />
          Automático (usa el mínimo de tu plan)
        </label>

        {(error || (!automatico && errores.intervaloSeg)) && (
          <p role="alert" className="text-label text-danger">
            {error ?? errores.intervaloSeg}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
