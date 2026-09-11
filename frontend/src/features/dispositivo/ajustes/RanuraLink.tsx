import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { TextoError } from '@/components/ui/TextoError'
import { IconoEnlace } from '@/components/layout/iconos'
import { crearInvitacion } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { ETIQUETA_ROL } from '@/utils/dispositivos'
import type { Invitacion, RolCompartido } from '@/tipos'
import { FilaInvitacion } from './FilaInvitacion'

/* Una línea: el rol ya lo nombra el título y el detalle completo vive en el
   modal de invitar. Lo que no se puede perder es el "cualquiera". */
const EXPLICACION: Record<RolCompartido, string> = {
  editor: 'Cualquiera con el link administra el equipo.',
  viewer: 'Cualquiera con el link ve los datos, sin editar.',
}

/* El backend admite un único link global por rol: en vez de un botón "crear
   link" que puede fallar con 409, la ranura hace el límite imposible de pisar. */
export function RanuraLink({
  dispositivoId,
  rol,
  invitacion,
  puedeGestionar,
  onCambio,
}: {
  dispositivoId: string
  rol: RolCompartido
  invitacion: Invitacion | null
  puedeGestionar: boolean
  onCambio: () => void
}) {
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    setCreando(true)
    setError(null)
    try {
      await crearInvitacion(dispositivoId, { rol })
      onCambio()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos crear el link.'))
    } finally {
      setCreando(false)
    }
  }

  if (invitacion) {
    return (
      <FilaInvitacion
        dispositivoId={dispositivoId}
        invitacion={invitacion}
        puedeGestionar={puedeGestionar}
        onCambio={onCambio}
      />
    )
  }

  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-7.5 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-muted"
        >
          <IconoEnlace className="size-3.75" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-label-lg font-medium text-text">{ETIQUETA_ROL[rol]}</span>
            <span className="text-note text-text-faint">{EXPLICACION[rol]}</span>
          </div>

          {puedeGestionar && (
            <Boton
              type="button"
              variante="sutil"
              className="self-start sm:shrink-0"
              disabled={creando}
              onClick={crear}
            >
              {creando ? 'Creando…' : 'Crear link'}
            </Boton>
          )}
        </div>
      </div>

      {error && <TextoError className="mt-1.5 pl-10">{error}</TextoError>}
    </li>
  )
}
