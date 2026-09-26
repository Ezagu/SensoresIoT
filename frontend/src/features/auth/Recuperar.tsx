import { useSearchParams } from 'react-router-dom'
import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Campo, CampoPassword } from '@/components/ui/Campo'
import { useFormulario } from '@/hooks/usarFormulario'
import { esquemaNuevaClave, esquemaRecuperar } from '@/utils/validacion'
import { IconoCorreo } from './IconoCorreo'
import { MarcoAuth, PieAuth } from './MarcoAuth'

/* PENDIENTE (backend): no hay endpoint de recuperación. Hace falta un token de
   un solo uso con vencimiento y el mail por Resend. Las tres pantallas están
   armadas; las acciones quedan deshabilitadas hasta que exista. */

export function Recuperar() {
  const { campo } = useFormulario(esquemaRecuperar, { email: '' })
  return (
    <MarcoAuth
      titulo="¿Olvidaste tu contraseña?"
      volver={{ a: '/login', etiqueta: 'Volver a ingresar' }}
      subtitulo="Escribí tu email y te mandamos un enlace para elegir una nueva."
    >
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4" noValidate>
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          {...campo('email')}
        />
        <Boton type="submit" disabled className="mt-2 w-full" title="Pendiente de backend">
          Enviar enlace
        </Boton>
        <AvisoPendiente>
          el backend todavía no tiene recuperación de contraseña (token de un solo uso + mail).
        </AvisoPendiente>
      </form>
    </MarcoAuth>
  )
}

export function RecuperarEnviado() {
  const [params] = useSearchParams()
  const email = params.get('email')
  return (
    <MarcoAuth
      titulo="Revisá tu correo."
      encabezado={<IconoCorreo />}
      subtitulo={
        <>
          Si {email ? <b className="font-semibold text-text">{email}</b> : 'ese email'} tiene una
          cuenta, le llegó un enlace para elegir una contraseña nueva. Vence en 1 hora.
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-body text-text-muted">¿No llegó? Mirá en spam.</span>
        <Boton variante="sutil" disabled title="Pendiente de backend">
          Reenviar
        </Boton>
      </div>
      <BotonLink to="/login" variante="sutil" className="mt-5 w-full">
        Volver a ingresar
      </BotonLink>
      <div className="mt-4">
        <AvisoPendiente>esta pantalla se muestra cuando exista el envío del enlace.</AvisoPendiente>
      </div>
    </MarcoAuth>
  )
}

export function NuevaClave() {
  const { campo } = useFormulario(esquemaNuevaClave, { password: '', confirmar: '' })
  return (
    <MarcoAuth titulo="Elegí una contraseña nueva.">
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4" noValidate>
        <CampoPassword
          etiqueta="Contraseña nueva"
          autoComplete="new-password"
          ayuda="8 caracteres o más."
          {...campo('password')}
        />
        <CampoPassword
          etiqueta="Confirmar contraseña"
          autoComplete="new-password"
          {...campo('confirmar')}
        />
        <Boton type="submit" disabled className="mt-2 w-full" title="Pendiente de backend">
          Guardar y entrar
        </Boton>
      </form>
      <PieAuth>
        <span className="text-body text-text-faint">
          Se cierran las sesiones abiertas en otros dispositivos.
        </span>
      </PieAuth>
      <AvisoPendiente>
        el backend todavía no valida el enlace ni guarda la contraseña nueva.
      </AvisoPendiente>
    </MarcoAuth>
  )
}
