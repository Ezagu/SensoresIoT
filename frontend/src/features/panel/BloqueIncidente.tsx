import { Link } from 'react-router-dom'
import { BotonLink } from '@/components/ui/Boton'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { IconoChevron, IconoFlecha } from '@/components/layout/iconos'
import type { FilaCartera } from '@/components/layout/ListaEquipos'
import type { AvisoDeEquipo, AvisoDeRegla } from '@/tipos'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { medida, numero } from '@/utils/formato'
import { etiquetarSensores } from '@/utils/sensores'
import { aLas, haceCuanto } from '@/utils/tiempo'
import { GraficoIncidente } from './GraficoIncidente'
import { VENTANA_INCIDENTE_MS, type DetalleAlerta } from './usarIncidentes'

const SIGNO = { mayor: '>', menor: '<' } as const

function personas(n: number) {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`
}

/* Sólo se dice "no se pudo" con destinatarios > 0 y ningún envío: cero
   destinatarios es un equipo silenciado por todos, no una falla. */
function LineaAviso({ aviso, ahora }: { aviso: AvisoDeRegla | AvisoDeEquipo; ahora: number }) {
  if (aviso.destinatarios === 0) return null
  if (aviso.notificados === 0) {
    return <p className="text-body text-danger">No se pudo avisar por email.</p>
  }
  return (
    <p className="text-body leading-normal text-text-muted">
      <b className="font-medium text-text">Email a {personas(aviso.notificados)}</b> a{' '}
      {aLas(aviso.medicion_at, ahora)}.
    </p>
  )
}

/* Un bloque por equipo con una regla sonando: qué cruzó, cuánto, contra qué
   límite, cómo llegó ahí y a quién se avisó. Es lo único del panel con gráfico,
   y por eso el gráfico dice siempre sensor, unidad y período. */
export function BloqueAlerta({
  fila: { dispositivo: d },
  detalle,
  ahora,
}: {
  fila: FilaCartera
  detalle: DetalleAlerta | undefined
  ahora: number
}) {
  const etiquetas = etiquetarSensores(d.sensores)
  const regla = detalle?.regla
  const sensor = d.sensores.find((s) => (regla ? s.id === regla.sensor_id : s.disparada))
  const etiqueta = sensor ? etiquetas.get(sensor.id)!.etiqueta : 'Sensor'
  const ultimaLectura = d.sensores
    .map((s) => s.ultimo_at)
    .filter((t): t is string => t !== null)
    .sort()
    .at(-1)
  const enRango = d.sensores
    .filter((s) => s.id !== sensor?.id && !s.disparada && s.ultimo_valor !== null)
    .slice(0, 2)
  const nombre = nombreDeDispositivo(d.id, d.nombre)

  return (
    <article className="grid gap-6 rounded-card border border-danger-border bg-danger-soft p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)_220px] lg:gap-10">
      <div className="min-w-0">
        <p className="text-note-lg font-semibold text-danger">
          {regla?.estado_desde
            ? `Alerta activa desde ${aLas(regla.estado_desde, ahora)}`
            : 'Alerta activa'}
        </p>
        <h2 className="mt-3.5 truncate text-heading-lg md:text-title">{nombre}</h2>
        {regla && (
          <p className="mt-1 text-body-lg text-text-muted">
            {etiqueta} {regla.condicion === 'mayor' ? 'sobre' : 'bajo'} el umbral
            {regla.estado_desde ? ` ${haceCuanto(regla.estado_desde, ahora)}` : ''}.
          </p>
        )}
        <p className="mt-1 text-note-lg text-text-faint">
          {d.sensores.length} {d.sensores.length === 1 ? 'sensor' : 'sensores'}
          {ultimaLectura && (
            <>
              {' · última lectura '}
              <HaceCuanto iso={ultimaLectura} />
            </>
          )}
        </p>
        <div className="mt-5.5 flex flex-wrap items-baseline gap-2">
          <span className="num text-hero leading-none text-danger md:text-alarma">
            {sensor?.ultimo_valor != null ? numero(sensor.ultimo_valor) : '—'}
          </span>
          <span className="text-body-lg text-text-faint md:text-heading-lg">{sensor?.unidad}</span>
          {regla && (
            <span className="ml-auto text-body text-text-muted lg:ml-3.5">
              umbral{' '}
              <b className="num text-text">
                {SIGNO[regla.condicion]} {medida(regla.umbral, sensor?.unidad ?? '')}
              </b>
            </span>
          )}
        </div>
      </div>

      {regla && detalle?.grafico ? (
        <GraficoIncidente
          datos={detalle.grafico}
          umbral={regla.umbral}
          condicion={regla.condicion}
          desdeMs={ahora - VENTANA_INCIDENTE_MS}
          hastaMs={ahora}
          disparadaDesde={regla.estado_desde}
          titulo={`${etiqueta} · ${sensor?.unidad ?? ''}`}
        />
      ) : (
        <div className="hidden lg:block" />
      )}

      <div className="flex flex-col gap-1.5 lg:border-l lg:border-danger-border lg:pl-7">
        <span className="micro hidden lg:block">Aviso</span>
        {detalle?.aviso && <LineaAviso aviso={detalle.aviso} ahora={ahora} />}
        {enRango.map((s) => (
          <p key={s.id} className="hidden text-body leading-normal text-text-muted lg:block">
            {etiquetas.get(s.id)!.etiqueta} sigue en rango: {medida(s.ultimo_valor!, s.unidad)}.
          </p>
        ))}
        <BotonLink to={`/dispositivos/${d.id}`} className="mt-4 w-full lg:mt-auto">
          Ver equipo
          <IconoFlecha className="size-3.5" />
        </BotonLink>
      </div>
    </article>
  )
}

export function BloqueSilencio({
  fila: { dispositivo: d },
  aviso,
  ahora,
}: {
  fila: FilaCartera
  aviso: AvisoDeEquipo | null | undefined
  ahora: number
}) {
  const avisados =
    aviso && aviso.notificados > 0 ? ` Se avisó por email a ${personas(aviso.notificados)}.` : ''
  return (
    <Link
      to={`/dispositivos/${d.id}`}
      className="group flex items-center gap-4 rounded-card border border-border-control py-4.5 pr-5.5 pl-5 transition-colors duration-130 hover:border-accent-border md:pl-7.5"
    >
      <MarcaEstado estado="sin-reportar" className="size-2.5" />
      <div className="min-w-0">
        <p className="truncate text-heading font-semibold">{nombreDeDispositivo(d.id, d.nombre)}</p>
        <p className="text-body text-text-muted">
          Sin reportar
          {d.last_seen_at ? ` desde ${aLas(d.last_seen_at, ahora)}` : ''}.{avisados}
        </p>
      </div>
      <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-body font-medium text-accent group-hover:text-text md:inline-flex">
        Ver equipo
        <IconoChevron className="size-3.5" />
      </span>
      <IconoChevron className="ml-auto size-4 shrink-0 text-text-faint md:hidden" />
    </Link>
  )
}
