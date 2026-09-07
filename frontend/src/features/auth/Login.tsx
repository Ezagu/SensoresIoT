import { useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '@/features/auth/sesion'
import { esCuentaBloqueada, mensajeDeError } from '@/services/api'
import { esquemaLogin } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'
import { Boton } from '@/components/ui/Boton'
import { Campo, CampoPassword } from '@/components/ui/Campo'
import { MarcoAuth } from './MarcoAuth'
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
    <MarcoAuth titulo="Entrar a Bitácora" subtitulo="Monitoreá tus dispositivos y sus alertas.">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
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
          {...campo('password')}
        />

        {error && (
          <TextoError>
            {error}
          </TextoError>
        )}

        <Boton type="submit" disabled={enviando} className="mt-1 w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>

      <p className="mt-4 text-label-lg text-text-muted text-center">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-medium text-accent hover:underline">
          Crear una
        </Link>
      </p>
    </MarcoAuth>
  )
}
