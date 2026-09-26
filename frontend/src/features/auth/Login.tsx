import { useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '@/features/auth/sesion'
import { esCuentaBloqueada, mensajeDeError } from '@/services/api'
import { esquemaLogin } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'
import { Boton } from '@/components/ui/Boton'
import { Campo, CampoPassword } from '@/components/ui/Campo'
import { ContinuarConGoogle, MarcoAuth, PieAuth } from './MarcoAuth'
import { TextoError } from '@/components/ui/TextoError'

export function Login() {
  const { login } = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const { campo, validar } = useFormulario(esquemaLogin, { email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await login(datos.email, datos.password)
      const destino = (location.state as { desde?: string } | null)?.desde ?? '/'
      navigate(destino, { replace: true })
    } catch (err) {
      setError(
        esCuentaBloqueada(err)
          ? 'Demasiados intentos fallidos. Probá de nuevo en 15 minutos.'
          : mensajeDeError(err, 'No pudimos iniciar sesión.'),
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <MarcoAuth titulo="Ingresar">
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          {...campo('email')}
        />
        <CampoPassword
          etiqueta="Contraseña"
          autoComplete="current-password"
          accesorio={
            <Link to="/recuperar" className="text-note-lg font-medium text-accent hover:text-text">
              ¿Olvidaste tu contraseña?
            </Link>
          }
          {...campo('password')}
        />

        {error && <TextoError>{error}</TextoError>}

        <Boton type="submit" disabled={enviando} className="mt-2 w-full">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>
      </form>

      <ContinuarConGoogle />

      <PieAuth>
        ¿Todavía no tenés cuenta?{' '}
        <Link to="/registro" className="font-medium text-accent hover:text-text">
          Crear cuenta
        </Link>
      </PieAuth>
    </MarcoAuth>
  )
}
