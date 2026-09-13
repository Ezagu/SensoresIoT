import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { FilaAjuste } from '@/components/ui/FilaAjuste'
import { Modal } from '@/components/ui/Modal'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { TextoError } from '@/components/ui/TextoError'
import { useSesion } from '@/features/auth/sesion'
import { mensajeDeError } from '@/services/api'
import { cerrarSesionGlobal } from '@/services/consultas'
import { ModalPassword } from './ModalPassword'

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
      <div className="flex flex-col divide-y divide-border">
        <FilaAjuste
          id="password"
          titulo="Contraseña"
          descripcion="Cambia la contraseña de tu cuenta."
        >
          <div className="flex items-center gap-3">
            {passwordOk && (
              <span role="status" className="text-note text-ok">
                Cambiada.
              </span>
            )}
            <Boton
              variante="fantasma"
              onClick={() => {
                setPasswordOk(false)
                setCambiandoPassword(true)
              }}
            >
              Cambiar
            </Boton>
          </div>
        </FilaAjuste>

        <FilaAjuste
          id="sesion-local"
          titulo="Cerrar sesión"
          descripcion="Cierra la sesión en este navegador y equipo."
        >
          <Boton variante="fantasma" onClick={() => void logout()}>
            Cerrar sesión
          </Boton>
        </FilaAjuste>

        <FilaAjuste
          id="sesion-global"
          titulo="Cerrar sesión en todos lados"
          descripcion="Cierra la sesión en todos los navegadores y equipos, este incluido."
        >
          {/* Fantasma y no destructivo: en una columna de botones con borde, el
              único transparente sería el más grave y el que menos se lee como
              botón. El rojo aparece con el puntero, igual que en "destructivo". */}
          <Boton
            variante="fantasma"
            className="hover:border-danger hover:text-danger focus-visible:text-danger"
            onClick={() => setConfirmandoTodo(true)}
          >
            Cerrar todas
          </Boton>
        </FilaAjuste>
      </div>

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
        <Modal abierto onCerrar={() => setConfirmandoTodo(false)} titulo="Cerrar todas las sesiones">
          <div className="flex flex-col gap-3.5">
            <p className="text-label text-text-muted">
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
