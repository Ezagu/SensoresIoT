import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Select } from '@/components/ui/Select'
import { TextoError } from '@/components/ui/TextoError'
import { invitarAcceso } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { esquemaInvitacion } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'

export function FormularioInvitar({
  dispositivoId,
  onInvitado,
  onCancelar,
}: {
  dispositivoId: string
  onInvitado: () => void
  onCancelar: () => void
}) {
  const { campo, validar } = useFormulario(esquemaInvitacion, { email: '', rol: 'viewer' })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await invitarAcceso(dispositivoId, { email: datos.email, rol: datos.rol })
      onInvitado()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos invitar a esa persona.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
      <Campo etiqueta="Email" type="email" placeholder="nombre@mail.com" {...campo('email')} />
      <Select etiqueta="Rol" {...campo('rol')}>
        <option value="editor">Editor</option>
        <option value="viewer">Solo lectura</option>
      </Select>
      <p className="text-note-lg text-text-faint">
        <strong className="font-medium text-text">Editor</strong> ve los datos y administra alertas, intervalo e
        identificación. <strong className="font-medium text-text">Solo lectura</strong> ve datos, gráficos e
        historial, y exporta. Ninguno de los dos puede compartir ni dar de baja el equipo.
      </p>

      {error && <TextoError>{error}</TextoError>}

      <div className="mt-1 flex justify-end gap-2">
        <Boton type="button" variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Invitando…' : 'Invitar'}
        </Boton>
      </div>
    </form>
  )
}
