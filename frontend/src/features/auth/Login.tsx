import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '@/lib/auth'
import { esCuentaBloqueada, mensajeDeError } from '@/lib/api'
import { Boton } from '@/components/ui/Boton'
import { MarcoAuth, Campo } from './MarcoAuth'

export function Login() {
  const { login } = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await login(email, password)
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
    <MarcoAuth titulo="Entrar a Bitácora" subtitulo="Monitoreá tus equipos y sus alertas.">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Campo
          id="email"
          etiqueta="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Campo
          id="password"
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        )}

        <Boton type="submit" disabled={enviando} className="mt-1 w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>

      <p className="mt-4 text-[12.5px] text-text-muted">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-medium text-accent hover:underline">
          Crear una
        </Link>
      </p>
    </MarcoAuth>
  )
}
