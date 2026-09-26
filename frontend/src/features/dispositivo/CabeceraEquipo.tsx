import { Link } from 'react-router-dom'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { MarcaEstado, type Estado } from '@/components/ui/MarcaEstado'
import { IconoCompartir, IconoControles, IconoDocumento } from '@/components/layout/iconos'
import type { Alerta, DispositivoDetalle } from '@/tipos'
import { esDuenio, nombreDeDispositivo } from '@/utils/dispositivos'
import { intervalo } from '@/utils/formato'
import { aLas, ETIQUETA_ESTADO, haceCuanto, type EstadoDispositivo } from '@/utils/tiempo'
import type { SensorConMeta } from './usarDispositivo'

type EstadoCabecera = { glifo: Estado; titulo: string; tono: string; detalle: React.ReactNode }

/* Una línea que contesta "¿qué le pasa?": la regla sonando gana sobre la
   conectividad, igual que en la barra lateral. */
function estadoPrincipal(
  disparada: Alerta | undefined,
  sensores: SensorConMeta[],
  conectividad: EstadoDispositivo,
  activo: boolean,
  lastSeenAt: string | null,
  lastDataAt: string | null,
  ahora: number,
): EstadoCabecera {
  if (!activo)
    return { glifo: 'inactivo', titulo: 'Desactivado', tono: 'text-text-muted', detalle: null }
  if (disparada) {
    const sensor = sensores.find((s) => s.id === disparada.sensor_id)?.etiqueta ?? 'Un sensor'
    return {
      glifo: 'critico',
      titulo: `${sensor} ${disparada.condicion === 'mayor' ? 'sobre' : 'bajo'} el umbral`,
      tono: 'text-danger',
      detalle: disparada.estado_desde
        ? `desde ${aLas(disparada.estado_desde, ahora)} · ${haceCuanto(disparada.estado_desde, ahora)}`
        : null,
    }
  }
  switch (conectividad) {
    case 'sin-reportar':
      return {
        glifo: 'sin-reportar',
        titulo: 'Sin reportar',
        tono: 'text-text',
        detalle: lastSeenAt ? `desde ${aLas(lastSeenAt, ahora)}` : null,
      }
    case 'nunca':
      return {
        glifo: 'sin-datos',
        titulo: 'Nunca reportó',
        tono: 'text-text',
        detalle: 'todavía no llegó ninguna lectura',
      }
    case 'con-retraso':
      return {
        glifo: 'atencion',
        titulo: 'Con retraso',
        tono: 'text-attention',
        detalle: (
          <>
            última lectura <HaceCuanto iso={lastDataAt} />
          </>
        ),
      }
    default:
      return {
        glifo: 'normal',
        titulo: 'En orden',
        tono: 'text-text',
        detalle: (
          <>
            última lectura <HaceCuanto iso={lastDataAt ?? lastSeenAt} />
          </>
        ),
      }
  }
}

export function CabeceraEquipo({
  dispositivo,
  sensores,
  alertas,
  conectividad,
  lastSeenAt,
  lastDataAt,
  ahora,
  onInforme,
}: {
  dispositivo: DispositivoDetalle
  sensores: SensorConMeta[]
  alertas: Alerta[]
  conectividad: EstadoDispositivo
  lastSeenAt: string | null
  lastDataAt: string | null
  ahora: number
  onInforme: () => void
}) {
  const disparada = alertas.find((a) => a.activa && a.estado === 'disparada')
  const estado = estadoPrincipal(
    disparada,
    sensores,
    conectividad,
    dispositivo.activo,
    lastSeenAt,
    lastDataAt,
    ahora,
  )
  const meta = [
    dispositivo.ubicacion,
    ETIQUETA_ESTADO[conectividad],
    `publica cada ${intervalo(dispositivo.intervalo_efectivo_seg)}`,
    `${sensores.length} ${sensores.length === 1 ? 'sensor' : 'sensores'}`,
  ].filter(Boolean)

  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
      <div className="min-w-0">
        <h1 className="text-page md:text-page-lg">
          {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
        </h1>
        {/* role="status": conectividad y alertas cambian solas mientras se mira. */}
        <p
          role="status"
          aria-atomic="true"
          className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-heading"
        >
          <MarcaEstado estado={estado.glifo} latiendo className="size-2.5" />
          <b className={`font-semibold ${estado.tono}`}>{estado.titulo}</b>
          {estado.detalle && <span className="text-text-muted">{estado.detalle}</span>}
        </p>
        <p className="mt-2 text-note-lg text-text-faint">{meta.join(' · ')}</p>
        {dispositivo.descripcion && (
          <p className="mt-2 max-w-150 text-pretty text-note-lg text-text-faint">
            {dispositivo.descripcion}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2 md:pt-1">
        {/* PENDIENTE (Tier 4.6): el modal abre, pero generar el PDF todavía no anda. */}
        <Boton variante="acento" onClick={onInforme} className="flex-1 md:flex-none">
          <IconoDocumento className="size-4" />
          <span className="md:hidden">Informe</span>
          <span className="hidden md:inline">Generar informe</span>
        </Boton>
        {esDuenio(dispositivo.rol) && (
          <BotonLink
            variante="sutil"
            to={`/dispositivos/${dispositivo.id}/ajustes#accesos`}
            className="flex-1 md:flex-none"
          >
            <IconoCompartir className="size-4" />
            Compartir
          </BotonLink>
        )}
        <Link
          to={`/dispositivos/${dispositivo.id}/ajustes`}
          aria-label="Ajustes del equipo"
          title="Ajustes del equipo"
          className="flex size-10 shrink-0 items-center justify-center rounded-control border border-border-control text-text-muted transition-colors duration-130 hover:border-accent-border hover:text-text"
        >
          <IconoControles className="size-4" />
        </Link>
      </div>
    </header>
  )
}
