import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { TextoError } from '@/components/ui/TextoError'
import { useSesion } from '@/features/auth/sesion'
import { useFormulario } from '@/hooks/usarFormulario'
import { mensajeDeError } from '@/services/api'
import { actualizarPerfil } from '@/services/consultas'
import { esquemaPerfil } from '@/utils/validacion'

export function SeccionPerfil({ id }: { id: string }) {
  const { sesion, refrescarSesion } = useSesion()
  const inicial = { nombre: sesion?.nombre ?? '', email: sesion?.email ?? '' }
  const { valores, campo, validar } = useFormulario(esquemaPerfil, inicial)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const sucio = valores.nombre !== inicial.nombre || valores.email !== inicial.email
  const cambiaElEmail = valores.email.trim().toLowerCase() !== inicial.email.toLowerCase()

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setGuardadoOk(false)
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await actualizarPerfil({ nombre: datos.nombre, email: datos.email })
      setGuardadoOk(true)
      await refrescarSesion()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos guardar los cambios.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <SeccionAjustes id={id} titulo="Perfil" descripcion="Cómo te identificamos en la app y en los mails.">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Campo etiqueta="Nombre" autoComplete="name" {...campo('nombre')} />
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="email"
          ayuda={
            cambiaElEmail
              ? 'Te vamos a mandar un link a la dirección nueva. Hasta que la abras, seguís entrando con la de ahora.'
              : 'Es con el que entrás y al que llegan las notificaciones.'
          }
          {...campo('email')}
        />

        {error && <TextoError>{error}</TextoError>}

        <div className="mt-1 flex items-center justify-end gap-3">
          {guardadoOk && (
            <span role="status" className="text-note text-ok">
              Guardado.
            </span>
          )}
          <Boton type="submit" disabled={!sucio || enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </SeccionAjustes>
  )
}
