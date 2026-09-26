import { useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pill } from '@/components/ui/Pill'
import { useSesion } from '@/features/auth/sesion'
import { useRastro } from '@/hooks/usarCabecera'
import {
  esDuenio as esDuenioDispositivo,
  nombreDeDispositivo,
  puedeEditar as puedeEditarDispositivo,
} from '@/utils/dispositivos'
import { useDispositivo, useSensoresConMeta } from '../usarDispositivo'
import { ErrorDeCarga, Navegable } from '../ErrorDeCarga'
import { SeccionIdentificacion } from './SeccionIdentificacion'
import { SeccionMuestreo } from './SeccionMuestreo'
import { SeccionAcceso } from './SeccionAcceso'
import { SeccionNotificaciones } from './SeccionNotificaciones'
import { FichaEquipo } from './FichaEquipo'
import { ZonaDeRiesgo } from './ZonaDeRiesgo'

function EsqueletoAjustes() {
  return (
    <div className="flex max-w-180 flex-col gap-3">
      <Skeleton className="h-6 w-56" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  )
}

export function AjustesDispositivo() {
  const { id } = useParams<{ id: string }>()
  const { sesion, plan } = useSesion()
  const equipo = useDispositivo(id ?? '')
  const sensores = useSensoresConMeta(id ?? '')

  const dispositivo = equipo.datos
  useRastro(
    dispositivo
      ? [
          { etiqueta: 'Todos los equipos', a: '/' },
          {
            etiqueta: nombreDeDispositivo(dispositivo.id, dispositivo.nombre),
            a: `/dispositivos/${dispositivo.id}`,
          },
          { etiqueta: 'Ajustes del equipo' },
        ]
      : null,
  )

  if (!id) return <Navegable titulo="Dispositivo no encontrado" volverA="/" />

  if (equipo.cargando || sensores.cargando) return <EsqueletoAjustes />

  const error = equipo.error ?? sensores.error
  if (error && !dispositivo) {
    return (
      <ErrorDeCarga
        error={error}
        errorCrudo={equipo.errorCrudo ?? sensores.errorCrudo}
        recurso="dispositivo"
        volverA="/"
        onReintentar={equipo.refrescar}
      />
    )
  }
  if (!dispositivo) return null

  const puedeEditar = puedeEditarDispositivo(dispositivo.rol)
  const puedeGestionarAcceso = esDuenioDispositivo(dispositivo.rol)
  const sensoresBase = sensores.datos ?? []

  return (
    <div className="flex max-w-180 flex-col gap-3">
      {!puedeEditar && (
        <div className="mb-1">
          <Pill tono="faint">Solo lectura</Pill>
        </div>
      )}

      <SeccionIdentificacion dispositivo={dispositivo} puedeEditar={puedeEditar} onGuardado={equipo.refrescar} />

      <SeccionMuestreo
        dispositivo={dispositivo}
        puedeEditar={puedeEditar}
        onGuardado={equipo.refrescar}
      />

      <SeccionAcceso
        dispositivoId={dispositivo.id}
        esDuenio={puedeGestionarAcceso}
        puedeCompartir={plan?.plan.puede_compartir ?? false}
        usuarioActualId={sesion?.usuario_id ?? ''}
      />

      <SeccionNotificaciones dispositivo={dispositivo} onGuardado={equipo.refrescar} />

      <FichaEquipo dispositivo={dispositivo} sensores={sensoresBase} />

      <ZonaDeRiesgo
        dispositivo={dispositivo}
        esDuenio={puedeGestionarAcceso}
        usuarioActualId={sesion?.usuario_id ?? ''}
      />
    </div>
  )
}
