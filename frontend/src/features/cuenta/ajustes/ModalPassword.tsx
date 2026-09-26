import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { CampoPassword } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { TextoError } from '@/components/ui/TextoError'
import { useFormulario } from '@/hooks/usarFormulario'
import { mensajeDeError } from '@/services/api'
import { cambiarPassword } from '@/services/consultas'
import { esquemaPassword } from '@/utils/validacion'

const VACIO = { actual: '', nueva: '', repetir: '' }

/* Es de las pocas cosas que sí piden un modal: hay que escribir la contraseña
   actual, y ese foco protegido no se puede armar en un renglón de la lista. */
export function ModalPassword({
  abierto,
  onCerrar,
  onCambiada,
}: {
  abierto: boolean
  onCerrar: () => void
  onCambiada: () => void
}) {
  const { valores, campo, validar } = useFormulario(esquemaPassword, VACIO)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await cambiarPassword({ password_actual: datos.actual, password_nueva: datos.nueva })
      onCambiada()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos cambiar la contraseña.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Cambiar contraseña">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <CampoPassword
          etiqueta="Contraseña actual"
          autoComplete="current-password"
          {...campo('actual')}
        />
        <CampoPassword
          etiqueta="Contraseña nueva"
          autoComplete="new-password"
          ayuda={valores.nueva.length > 0 ? undefined : 'Mínimo 8 caracteres.'}
          {...campo('nueva')}
        />
        <CampoPassword
          etiqueta="Repetir la nueva"
          autoComplete="new-password"
          {...campo('repetir')}
        />

        {error && <TextoError>{error}</TextoError>}

        <div className="mt-1 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Cambiando…' : 'Cambiar contraseña'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
