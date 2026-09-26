import { useState } from 'react'
import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { Boton } from '@/components/ui/Boton'
import { FilaAjuste, ValorAjuste } from '@/components/ui/FilaAjuste'
import { Modal } from '@/components/ui/Modal'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { TextoError } from '@/components/ui/TextoError'
import { useSesion } from '@/features/auth/sesion'
import { mensajeDeError } from '@/services/api'
import { cerrarSesionGlobal } from '@/services/consultas'
import { ModalPassword } from './ModalPassword'

/* Colores de marca de Google, no del sistema: el logo no se tiñe. */
function IconoGoogle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0">
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  )
}

export function SeccionSeguridad({ id }: { id: string }) {
  const { logout } = useSesion()
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [passwordOk, setPasswordOk] = useState(false)
  const [confirmandoTodo, setConfirmandoTodo] = useState(false)
  const [cerrandoTodo, setCerrandoTodo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cerrarTodo() {
    setCerrandoTodo(true)
    setError(null)
    try {
      await cerrarSesionGlobal()
      // Borra también el refresh token de esta pestaña, así que la sesión local
      // ya no vale: cerrarla acá es lo que manda al login en vez de a un 401.
      await logout()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos cerrar las sesiones.'))
      setConfirmandoTodo(false)
      setCerrandoTodo(false)
    }
  }

  return (
    <SeccionAjustes id={id} titulo="Seguridad">
      <div className="flex flex-col">
        <FilaAjuste
          id="password"
          titulo="Contraseña"
          accion={
            <>
              {passwordOk && (
                <span role="status" className="text-note text-ok">
                  Cambiada.
                </span>
              )}
              <Boton
                variante="sutil"
                onClick={() => {
                  setPasswordOk(false)
                  setCambiandoPassword(true)
                }}
              >
                Cambiar
              </Boton>
            </>
          }
        >
          <ValorAjuste>••••••••</ValorAjuste>
        </FilaAjuste>

        {/* PENDIENTE (OAuth diferido en CLAUDE.md): vincular Google no existe todavía. */}
        <FilaAjuste
          id="google"
          titulo="Google"
          accion={
            <Boton variante="sutil" disabled title="Pendiente de backend">
              Vincular
            </Boton>
          }
        >
          <p className="flex items-center gap-2.5 text-body-lg">
            <IconoGoogle />
            Sin vincular
          </p>
        </FilaAjuste>

        {/* PENDIENTE (backend): no hay lista de sesiones; "Cerrar todas" sí existe. */}
        <FilaAjuste
          id="sesiones"
          titulo="Sesiones"
          accion={
            <Boton variante="sutil" onClick={() => setConfirmandoTodo(true)}>
              Cerrar todas
            </Boton>
          }
        >
          <ValorAjuste detalle="cuántas y dónde, pendiente">Abierta en este navegador</ValorAjuste>
        </FilaAjuste>
      </div>

      <AvisoPendiente>
        vincular con Google (OAuth, diferido) y la lista de sesiones abiertas todavía no están en el
        backend. Cambiar la contraseña y cerrar todas las sesiones sí funcionan.
      </AvisoPendiente>

      {error && <TextoError>{error}</TextoError>}

      <ModalPassword
        abierto={cambiandoPassword}
        onCerrar={() => setCambiandoPassword(false)}
        onCambiada={() => {
          setCambiandoPassword(false)
          setPasswordOk(true)
        }}
      />

      {confirmandoTodo && (
        <Modal
          abierto
          onCerrar={() => setConfirmandoTodo(false)}
          titulo="Cerrar todas las sesiones"
        >
          <div className="flex flex-col gap-3.5">
            <p className="text-body text-text-muted">
              Vas a tener que volver a entrar acá y en cualquier otro navegador donde estés. Tus
              equipos siguen midiendo y mandando lecturas.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={() => setConfirmandoTodo(false)}>
                Cancelar
              </Boton>
              <Boton type="button" disabled={cerrandoTodo} onClick={cerrarTodo}>
                {cerrandoTodo ? 'Cerrando…' : 'Cerrar todas'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </SeccionAjustes>
  )
}
