import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoMas } from '@/components/layout/iconos'
import { esLinkGlobal } from '@/utils/invitaciones'
import type { RolCompartido } from '@/tipos'
import { useAccesos } from './usarAccesos'
import { useInvitaciones } from './usarInvitaciones'
import { FilaAcceso } from './FilaAcceso'
import { FilaInvitacion } from './FilaInvitacion'
import { RanuraLink } from './RanuraLink'
import { FormularioInvitar } from './FormularioInvitar'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'

const ROLES_LINK: RolCompartido[] = ['editor', 'viewer']

const SUBTITULO = 'pt-1.5 text-note font-medium tracking-wide text-text-faint uppercase'

export function SeccionAcceso({
  dispositivoId,
  esDuenio,
  puedeCompartir,
  usuarioActualId,
}: {
  dispositivoId: string
  esDuenio: boolean
  /* Del plan de la CUENTA propia, no del equipo: compartir es una acción sobre
     tus propios dispositivos, la misma regla que rige el resto de "planes". */
  puedeCompartir: boolean
  usuarioActualId: string
}) {
  const {
    datos: datosAccesos,
    cargando: cargandoAccesos,
    refrescando: refrescandoAccesos,
    error: errorAccesos,
    refrescar: refrescarAccesos,
  } = useAccesos(dispositivoId)
  const {
    datos: datosInvitaciones,
    cargando: cargandoInvitaciones,
    refrescando: refrescandoInvitaciones,
    error: errorInvitaciones,
    refrescar: refrescarInvitaciones,
  } = useInvitaciones(dispositivoId, esDuenio)
  const [invitando, setInvitando] = useState(false)

  const accesos = datosAccesos ?? []
  const invitaciones = datosInvitaciones ?? []
  const pendientes = invitaciones.filter((i) => !esLinkGlobal(i))
  const linkDe = (rol: RolCompartido) => invitaciones.find((i) => esLinkGlobal(i) && i.rol === rol) ?? null

  // Sin ser dueño no hay nada que gestionar, así que el upsell de plan no
  // aplica: mostrarlo a un editor/viewer sería ofrecerle algo que no puede usar.
  const bloqueadoPorPlan = esDuenio && !puedeCompartir
  const cargando = cargandoAccesos || cargandoInvitaciones
  const refrescando = refrescandoAccesos || refrescandoInvitaciones
  const error = errorAccesos ?? errorInvitaciones

  return (
    <SeccionAjustes
      titulo="Acceso compartido"
      descripcion="Quién más ve este equipo, además de vos."
      accion={
        esDuenio && puedeCompartir ? (
          <Boton variante="sutil" onClick={() => setInvitando(true)}>
            <IconoMas className="size-3.5" />
            Invitar por email
          </Boton>
        ) : null
      }
    >
      {bloqueadoPorPlan ? (
        <Vacio
          titulo="Compartir es premium"
          detalle="Invitá a otras personas a ver este equipo desde su propia cuenta."
          accion={
            <Link to="/plan">
              <Boton variante="sutil">Ver planes</Boton>
            </Link>
          }
        />
      ) : cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : error ? (
        <TextoError>{error}</TextoError>
      ) : (
        <div className={`flex flex-col divide-y divide-border ${refrescando ? 'opacity-60' : ''}`}>
          <div className="py-1 first:pt-0">
            {accesos.length === 0 ? (
              <Vacio titulo="Nadie más tiene acceso" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {accesos.map((acceso) => (
                  <FilaAcceso
                    key={acceso.usuario_id}
                    dispositivoId={dispositivoId}
                    acceso={acceso}
                    esUsuarioActual={acceso.usuario_id === usuarioActualId}
                    puedeGestionar={esDuenio}
                    onCambio={refrescarAccesos}
                  />
                ))}
              </ul>
            )}
          </div>

          {esDuenio && pendientes.length > 0 && (
            <div className="py-1">
              <p className={SUBTITULO}>Invitaciones pendientes</p>
              <ul className="flex flex-col divide-y divide-border">
                {pendientes.map((invitacion) => (
                  <FilaInvitacion
                    key={invitacion.id}
                    dispositivoId={dispositivoId}
                    invitacion={invitacion}
                    puedeGestionar={esDuenio}
                    onCambio={refrescarInvitaciones}
                  />
                ))}
              </ul>
            </div>
          )}

          {esDuenio && (
            <div className="py-1">
              <p className={SUBTITULO}>Links de invitación</p>
              <ul className="flex flex-col divide-y divide-border">
                {ROLES_LINK.map((rol) => (
                  <RanuraLink
                    key={rol}
                    dispositivoId={dispositivoId}
                    rol={rol}
                    invitacion={linkDe(rol)}
                    puedeGestionar={esDuenio}
                    onCambio={refrescarInvitaciones}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Modal abierto={invitando} onCerrar={() => setInvitando(false)} titulo="Invitar por email">
        <FormularioInvitar
          dispositivoId={dispositivoId}
          onInvitado={() => {
            setInvitando(false)
            refrescarInvitaciones()
          }}
          onCancelar={() => setInvitando(false)}
        />
      </Modal>
    </SeccionAjustes>
  )
}
