import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoMas } from '@/components/layout/iconos'
import { useAccesos } from './usarAccesos'
import { FilaAcceso } from './FilaAcceso'
import { FormularioInvitar } from './FormularioInvitar'
import { SeccionAjustes } from './SeccionAjustes'

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
  const { datos, cargando, refrescando, error, refrescar } = useAccesos(dispositivoId)
  const [invitando, setInvitando] = useState(false)
  const accesos = datos ?? []

  // Sin ser dueño no hay nada que gestionar, así que el upsell de plan no
  // aplica: mostrarlo a un editor/viewer sería ofrecerle algo que no puede usar.
  const bloqueadoPorPlan = esDuenio && !puedeCompartir

  return (
    <SeccionAjustes
      titulo="Acceso compartido"
      descripcion="Quién más ve este equipo, además de vos."
      accion={
        esDuenio && puedeCompartir ? (
          <Boton variante="sutil" onClick={() => setInvitando(true)}>
            <IconoMas className="size-3.5" />
            Invitar
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
      ) : accesos.length === 0 ? (
        <Vacio titulo="Nadie más tiene acceso" />
      ) : (
        <ul className={`flex flex-col divide-y divide-border ${refrescando ? 'opacity-60' : ''}`}>
          {accesos.map((acceso) => (
            <FilaAcceso
              key={acceso.usuario_id}
              dispositivoId={dispositivoId}
              acceso={acceso}
              esUsuarioActual={acceso.usuario_id === usuarioActualId}
              puedeGestionar={esDuenio}
              onCambio={refrescar}
            />
          ))}
        </ul>
      )}

      <Modal abierto={invitando} onCerrar={() => setInvitando(false)} titulo="Compartir equipo">
        <FormularioInvitar
          dispositivoId={dispositivoId}
          onInvitado={() => {
            setInvitando(false)
            refrescar()
          }}
          onCancelar={() => setInvitando(false)}
        />
      </Modal>
    </SeccionAjustes>
  )
}
