import { useParams } from 'react-router-dom'
import { BotonCopiar } from '@/components/ui/BotonCopiar'
import { FilaAjuste, ValorAjuste } from '@/components/ui/FilaAjuste'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { IndiceAjustes, type Seccion } from '@/components/ui/IndiceAjustes'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { Pill } from '@/components/ui/Pill'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { Skeleton } from '@/components/ui/Skeleton'
import { useSesion } from '@/features/auth/sesion'
import { useAhora } from '@/hooks/usarAhora'
import { useRastro } from '@/hooks/usarCabecera'
import {
  esDuenio as esDuenioDispositivo,
  ETIQUETA_ROL,
  nombreDeDispositivo,
  puedeEditar as puedeEditarDispositivo,
} from '@/utils/dispositivos'
import { estadoDispositivo, TIC_RELOJ_MS } from '@/utils/tiempo'
import {
  useAlertasDispositivo,
  useDispositivo,
  useEstadoDispositivo,
  useSensoresConMeta,
} from '../usarDispositivo'
import { ErrorDeCarga, Navegable } from '../ErrorDeCarga'
import { SeccionAcceso } from './SeccionAcceso'
import { SeccionAlertas, SeccionConectividad, SeccionEnergia } from './SeccionesEstado'
import { SeccionIdentificacion } from './SeccionIdentificacion'
import { SeccionMuestreo } from './SeccionMuestreo'
import { SeccionNotificaciones } from './SeccionNotificaciones'
import { ZonaDeRiesgo } from './ZonaDeRiesgo'

/* Constantes de módulo: su identidad es la llave del observador del índice. */
const SECCIONES: Seccion[] = [
  { id: 'equipo', etiqueta: 'Equipo' },
  { id: 'conectividad', etiqueta: 'Conectividad' },
  { id: 'energia', etiqueta: 'Energía' },
  { id: 'alertas', etiqueta: 'Alertas' },
  { id: 'accesos', etiqueta: 'Acceso' },
]
const DESVINCULAR: Seccion = { id: 'desvincular', etiqueta: 'Desvincular' }

const TEXTO_CONECTIVIDAD = {
  nunca: 'todavía no se conectó',
  'en-linea': 'en línea',
  'con-retraso': 'con retraso',
  'sin-reportar': 'sin reportar',
} as const

function EsqueletoAjustes() {
  return (
    <div className="flex max-w-200 flex-col gap-4">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-4 w-72" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  )
}

export function AjustesDispositivo() {
  const { id = '' } = useParams<{ id: string }>()
  const { sesion, plan } = useSesion()
  const equipo = useDispositivo(id)
  const estado = useEstadoDispositivo(id)
  const sensores = useSensoresConMeta(id)
  const { alertas } = useAlertasDispositivo(id, estado.cadenciaSeg)
  const ahora = useAhora(TIC_RELOJ_MS)

  const dispositivo = equipo.datos
  useRastro(
    dispositivo
      ? [
          { etiqueta: 'Todos los equipos', a: '/' },
          {
            etiqueta: nombreDeDispositivo(dispositivo.id, dispositivo.nombre),
            a: `/dispositivos/${dispositivo.id}`,
          },
          { etiqueta: 'Ajustes' },
        ]
      : null,
  )

  if (!id) return <Navegable titulo="Equipo no encontrado" volverA="/" />
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
  const esDuenio = esDuenioDispositivo(dispositivo.rol)
  const conectividad = estadoDispositivo(
    {
      last_seen_at: estado.datos?.last_seen_at ?? null,
      last_data_at: estado.datos?.last_data_at ?? null,
      online: estado.datos?.online ?? false,
      intervalo_efectivo_seg: dispositivo.intervalo_efectivo_seg,
      intervalo_modificado_at: estado.datos?.intervalo_modificado_at ?? null,
    },
    ahora,
  )
  const glifo = {
    nunca: 'sin-datos',
    'en-linea': 'normal',
    'con-retraso': 'atencion',
    'sin-reportar': 'sin-reportar',
  } as const
  const lastSeen = estado.datos?.last_seen_at ?? null

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:gap-14">
      <div className="xl:pt-17">
        <IndiceAjustes secciones={SECCIONES} peligro={DESVINCULAR} />
      </div>

      <div className="min-w-0 flex-1">
        <header className="pb-9">
          <div className="flex items-center gap-3">
            <h1 className="text-page">Ajustes</h1>
            {!puedeEditar && <Pill tono="faint">Solo lectura</Pill>}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-body text-text-muted">
            <MarcaEstado estado={glifo[conectividad]} />
            {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)} ·{' '}
            {TEXTO_CONECTIVIDAD[conectividad]}
            {lastSeen && (
              <>
                , último contacto <HaceCuanto iso={lastSeen} />
              </>
            )}
          </p>
        </header>

        <SeccionAjustes id="equipo" titulo="Equipo">
          <div className="flex flex-col">
            <SeccionIdentificacion
              dispositivo={dispositivo}
              puedeEditar={puedeEditar}
              onGuardado={equipo.refrescar}
            />
            <FilaAjuste
              id="fila-id"
              titulo="Identificador"
              accion={
                <BotonCopiar
                  texto={dispositivo.id}
                  etiqueta="Copiar identificador"
                  variante="icono"
                />
              }
            >
              {/* Lo primero que se pide por teléfono en un soporte. */}
              <p className="truncate font-mono text-body text-text">{dispositivo.id}</p>
            </FilaAjuste>
            <FilaAjuste id="fila-duenio" titulo="Dueño">
              <ValorAjuste detalle={`vos sos ${ETIQUETA_ROL[dispositivo.rol].toLowerCase()}`}>
                {dispositivo.owner_nombre ?? '—'}
              </ValorAjuste>
            </FilaAjuste>
            <SeccionMuestreo
              dispositivo={dispositivo}
              puedeEditar={puedeEditar}
              onGuardado={equipo.refrescar}
            />
            <SeccionNotificaciones dispositivo={dispositivo} onGuardado={equipo.refrescar} />
          </div>
        </SeccionAjustes>

        <SeccionConectividad id="conectividad" />
        <SeccionEnergia id="energia" />
        <SeccionAlertas
          id="alertas"
          dispositivoId={dispositivo.id}
          alertas={alertas}
          sensores={sensores.datos ?? []}
        />

        <SeccionAcceso
          dispositivoId={dispositivo.id}
          esDuenio={esDuenio}
          puedeCompartir={plan?.plan.puede_compartir ?? false}
          usuarioActualId={sesion?.usuario_id ?? ''}
        />

        <ZonaDeRiesgo
          id={DESVINCULAR.id}
          dispositivo={dispositivo}
          esDuenio={esDuenio}
          usuarioActualId={sesion?.usuario_id ?? ''}
        />
      </div>
    </div>
  )
}
