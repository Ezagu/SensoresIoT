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
import { IconoGoogle } from '@/components/ui/IconoGoogle'

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
