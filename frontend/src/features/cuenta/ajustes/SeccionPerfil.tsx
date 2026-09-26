import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { FilaAjuste, ValorAjuste } from '@/components/ui/FilaAjuste'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { TextoError } from '@/components/ui/TextoError'
import { useSesion } from '@/features/auth/sesion'
import { useFormulario } from '@/hooks/usarFormulario'
import { mensajeDeError } from '@/services/api'
import { actualizarPerfil } from '@/services/consultas'
import { esquemaPerfil } from '@/utils/validacion'

/* El email no se edita acá: es con lo que se entra y adonde llegan los avisos. */
export function SeccionPerfil({ id }: { id: string }) {
  const { sesion, refrescarSesion } = useSesion()
  const inicial = { nombre: sesion?.nombre ?? '' }
  const { valores, campo, validar } = useFormulario(esquemaPerfil, inicial)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const sucio = valores.nombre !== inicial.nombre

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setGuardadoOk(false)
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await actualizarPerfil({ nombre: datos.nombre })
      setGuardadoOk(true)
      await refrescarSesion()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos guardar los cambios.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <SeccionAjustes id={id} titulo="Perfil">
      <form onSubmit={enviar} noValidate className="flex flex-col">
        <FilaAjuste
          id="fila-nombre"
          titulo="Nombre"
          accion={
            sucio ? (
              <Boton type="submit" disabled={enviando}>
                {enviando ? 'Guardando…' : 'Guardar'}
              </Boton>
            ) : (
              guardadoOk && (
                <span role="status" className="text-note text-ok">
                  Guardado.
                </span>
              )
            )
          }
        >
          <div className="max-w-85">
            <Campo etiqueta="Nombre" etiquetaOculta autoComplete="name" {...campo('nombre')} />
          </div>
        </FilaAjuste>
        {error && <TextoError>{error}</TextoError>}
        <FilaAjuste id="fila-email" titulo="Email">
          <ValorAjuste>{sesion?.email}</ValorAjuste>
        </FilaAjuste>
      </form>
    </SeccionAjustes>
  )
}
