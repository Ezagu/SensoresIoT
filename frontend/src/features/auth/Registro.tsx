import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, mensajeDeError } from '@/lib/api'
import { esquemaRegistro, useFormulario } from '@/lib/formularios'
import { Boton } from '@/components/ui/Boton'
import { MarcoAuth, Campo, CampoPassword } from './MarcoAuth'

export function Registro() {
  const { campo, validar } = useFormulario(esquemaRegistro, {
    nombre: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await api.post('/auth/register', datos)
      setEnviadoA(datos.email)
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos crear la cuenta.'))
    } finally {
      setEnviando(false)
    }
  }

  if (enviadoA) {
    return (
      <MarcoAuth titulo="Revisá tu correo">
        <p className="text-label-lg text-text-muted">
          Te mandamos un link de verificación a <strong className="text-text">{enviadoA}</strong>.
          Verificá la cuenta y después iniciá sesión.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-block text-label-lg font-medium text-accent hover:underline"
        >
          Ir a iniciar sesión
        </Link>
      </MarcoAuth>
    )
  }

  return (
    <MarcoAuth titulo="Crear cuenta" subtitulo="Necesitás una para vincular tus dispositivos.">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Campo etiqueta="Nombre" autoComplete="name" {...campo('nombre')} />
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          {...campo('email')}
        />
        <CampoPassword
          etiqueta="Contraseña"
          autoComplete="new-password"
          ayuda="Mínimo 8 caracteres."
          {...campo('password')}
        />

        {error && (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        )}

        <Boton type="submit" disabled={enviando} className="mt-1 w-full">
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>

      <p className="mt-4 text-center text-label-lg text-text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </MarcoAuth>
  )
}
