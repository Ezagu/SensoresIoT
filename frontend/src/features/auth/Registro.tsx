import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, mensajeDeError } from '@/services/api'
import { esquemaRegistro } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'
import { BotonLink, Boton } from '@/components/ui/Boton'
import { Campo, CampoPassword } from '@/components/ui/Campo'
import { TextoError } from '@/components/ui/TextoError'
import { ContinuarConGoogle, MarcoAuth, PieAuth } from './MarcoAuth'
import { IconoCorreo } from './IconoCorreo'

export function Registro() {
  const { campo, validar } = useFormulario(esquemaRegistro, {
    nombre: '',
    email: '',
    password: '',
    confirmar: '',
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
      await api.post('/auth/register', {
        nombre: datos.nombre,
        email: datos.email,
        password: datos.password,
      })
      setEnviadoA(datos.email)
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos crear la cuenta.'))
    } finally {
      setEnviando(false)
    }
  }

  if (enviadoA) {
    return (
      <MarcoAuth
        titulo="Revisá tu correo."
        encabezado={<IconoCorreo />}
        subtitulo={
          <>
            Te mandamos un enlace de verificación a{' '}
            <b className="font-semibold text-text">{enviadoA}</b>. Verificá la cuenta y después
            ingresá.
          </>
        }
      >
        <BotonLink to="/login" variante="sutil" className="w-full">
          Ir a ingresar
        </BotonLink>
      </MarcoAuth>
    )
  }

  return (
    <MarcoAuth titulo="Crear cuenta">
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
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
          ayuda="8 caracteres o más."
          {...campo('password')}
        />
        <CampoPassword
          etiqueta="Confirmar contraseña"
          autoComplete="new-password"
          {...campo('confirmar')}
        />

        {error && <TextoError>{error}</TextoError>}

        <Boton type="submit" disabled={enviando} className="mt-2 w-full">
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>

      <ContinuarConGoogle />

      <PieAuth>
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-accent hover:text-text">
          Ingresar
        </Link>
      </PieAuth>
    </MarcoAuth>
  )
}
