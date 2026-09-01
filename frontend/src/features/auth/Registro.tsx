import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, mensajeDeError } from '@/lib/api'
import { Boton } from '@/components/ui/Boton'
import { MarcoAuth, Campo } from './MarcoAuth'

export function Registro() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirm_password: '' })
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const set = (campo: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await api.post('/auth/register', form)
      setListo(true)
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos crear la cuenta.'))
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <MarcoAuth titulo="Revisá tu correo">
        <p className="text-[12.5px] text-text-muted">
          Te mandamos un link de verificación a <strong className="text-text">{form.email}</strong>.
          Verificá la cuenta y después iniciá sesión.
        </p>
        <Link to="/login" className="mt-4 inline-block text-[12.5px] font-medium text-accent hover:underline">
          Ir a iniciar sesión
        </Link>
      </MarcoAuth>
    )
  }

  return (
    <MarcoAuth titulo="Crear cuenta" subtitulo="Necesitás una para vincular tus equipos.">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Campo id="nombre" etiqueta="Nombre" autoComplete="name" value={form.nombre} onChange={set('nombre')} required />
        <Campo
          id="email"
          etiqueta="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          value={form.email}
          onChange={set('email')}
          required
        />
        <Campo
          id="password"
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          required
        />
        <Campo
          id="confirm_password"
          etiqueta="Repetir contraseña"
          type="password"
          autoComplete="new-password"
          value={form.confirm_password}
          onChange={set('confirm_password')}
          required
        />

        {error && (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        )}

        <Boton type="submit" disabled={enviando} className="mt-1 w-full">
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>

      <p className="mt-4 text-[12.5px] text-text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </MarcoAuth>
  )
}
