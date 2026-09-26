import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { Grafico } from '@/components/graficos/Grafico'
import { LeyendaGrafico } from '@/components/graficos/LeyendaGrafico'
import { IconoExportar } from '@/components/layout/iconos'
import { useAhora } from '@/hooks/usarAhora'
import { useRastro } from '@/hooks/usarCabecera'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { esAvisoDeEquipo } from '@/tipos'
import { reglaDestacada, umbralesDeSensor } from '@/utils/alertas'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { medida, numero, intervalo } from '@/utils/formato'
import { limiteDeVentana } from '@/utils/retencion'
import { anclaEnCero } from '@/utils/sensores'
import { estadisticasDeGrafico, huecosDeGrafico, serieDeGrafico } from '@/utils/series'
import { aLas, duracionMs, estadoDispositivo, hora, TIC_RELOJ_MS } from '@/utils/tiempo'
import {
  bordesDeVentana,
  esTiempoReal,
  nombreDeVentana,
  resolverVentana,
  VENTANA_INICIAL,
} from '@/utils/ventana'
import { SIMBOLO_CONDICION } from './alertas/condicion'
import { AvisoVentana } from './AvisoVentana'
import { BarraVentana } from './BarraVentana'
import { BloqueExport } from './BloqueExport'
import { BloqueHistorial } from './BloqueHistorial'
import { ErrorDeCarga, Navegable } from './ErrorDeCarga'
import { LineaDeTiempo } from './LineaDeTiempo'
import { estadoDeSensor } from './SensoresEquipo'
import {
  useAlertasDispositivo,
  useDispositivo,
  useEstadoDispositivo,
  useEventosDispositivo,
  useSensoresConMeta,
} from './usarDispositivo'
import { useDatosSensor } from './usarGraficos'
import { useVentanaConZoom } from './usarVentana'

const fmtDia = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric' })

/* "hoy · 18:58" o "sáb 19 · 04:10": en una métrica del período alcanza con el
   día de la semana, el rango ya dice qué semana es. */
function cuando(ms: number, ahora: number) {
  const hoy = new Date(ahora).toDateString() === new Date(ms).toDateString()
  return `${hoy ? 'hoy' : fmtDia.format(ms).replace(',', '')} · ${hora(ms)}`
}

function Metrica({
  etiqueta,
  valor,
  unidad,
  pie,
  critico = false,
}: {
  etiqueta: string
  valor: string | null
  unidad?: string
  pie?: string
  critico?: boolean
}) {
  return (
    <div className="min-w-0 pt-4 lg:border-l lg:border-border lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
      <p className="text-note text-text-faint">{etiqueta}</p>
      <p className="mt-1 flex items-baseline gap-0.75">
        <b className={`num text-title ${critico ? 'text-danger' : 'text-text'}`}>{valor ?? '—'}</b>
        {valor !== null && unidad && (
          <small className="text-body font-medium text-text-faint">{unidad}</small>
        )}
      </p>
      {pie && <p className="mt-0.5 truncate text-note text-text-muted">{pie}</p>}
    </div>
  )
}

function EsqueletoSensor() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-16 w-48" />
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

export function DetalleSensor() {
  const { id = '', sensorId = '' } = useParams<{ id: string; sensorId: string }>()
  const [exportAbierto, setExportAbierto] = useState(false)
  const { ventana, elegir, zoomear, restablecer, hayZoom } = useVentanaConZoom(VENTANA_INICIAL)
  const enVivo = esTiempoReal(ventana)

  const equipo = useDispositivo(id)
  const estadoEquipo = useEstadoDispositivo(id)
  const sensores = useSensoresConMeta(id)
  const cadenciaSeg = estadoEquipo.cadenciaSeg
  const polling = useDatosSensor(sensorId, ventana, cadenciaSeg)
  const tic = useAhora(enVivo && cadenciaSeg ? cadenciaSeg * 1000 : TIC_RELOJ_MS)
  const { alertas: alertasDelEquipo } = useAlertasDispositivo(id, cadenciaSeg)
  const { eventos } = useEventosDispositivo(id, cadenciaSeg)
  const delPanel = useDispositivos().datos?.find((d) => d.id === id)

  const dispositivo = equipo.datos
  const sensor = sensores.datos?.find((s) => s.id === sensorId)

  useRastro(
    dispositivo && sensor
      ? [
          { etiqueta: 'Todos los equipos', a: '/' },
          {
            etiqueta: nombreDeDispositivo(dispositivo.id, dispositivo.nombre),
            a: `/dispositivos/${dispositivo.id}`,
          },
          { etiqueta: sensor.etiqueta },
        ]
      : null,
  )

  if (!id || !sensorId) return <Navegable titulo="Sensor no encontrado" volverA="/" />
  if (equipo.cargando || sensores.cargando || polling.cargando) return <EsqueletoSensor />

  const error = equipo.error ?? sensores.error
  if (error && !(dispositivo && sensores.datos)) {
    return (
      <ErrorDeCarga
        error={error}
        errorCrudo={equipo.errorCrudo ?? sensores.errorCrudo}
        recurso="sensor"
        volverA={`/dispositivos/${id}`}
        onReintentar={equipo.refrescar}
      />
    )
  }
  if (!dispositivo || !sensores.datos) return null
  if (!sensor) return <Navegable titulo="Este sensor no existe" volverA={`/dispositivos/${id}`} />

  const conectividad = estadoDispositivo(
    {
      last_seen_at: estadoEquipo.datos?.last_seen_at ?? null,
      last_data_at: estadoEquipo.datos?.last_data_at ?? null,
      online: estadoEquipo.datos?.online ?? false,
      intervalo_efectivo_seg: dispositivo.intervalo_efectivo_seg,
      intervalo_modificado_at: estadoEquipo.datos?.intervalo_modificado_at ?? null,
    },
    tic,
  )

  const alertas = alertasDelEquipo.filter((a) => a.sensor_id === sensor.id)
  const regla = reglaDestacada(alertas, sensor.id)
  const umbrales = umbralesDeSensor(alertas, sensor.id)
  const ultima = polling.datos?.ultima ?? null
  const estado = estadoDeSensor(
    sensor.id,
    alertas,
    { valor: ultima?.value ?? null, at: ultima?.time ?? null },
    dispositivo.intervalo_efectivo_seg,
    conectividad,
    tic,
  )

  const datosGrafico = polling.datos?.datos ?? null
  const { desde, hasta } = resolverVentana(ventana)
  const { hastaMs: hastaGrilla } = bordesDeVentana(ventana, tic)
  const grilla = datosGrafico ? serieDeGrafico(datosGrafico) : []
  const hayDatos = datosGrafico !== null && datosGrafico.puntos.length > 0
  const limite = limiteDeVentana(datosGrafico, dispositivo.first_connected_at, desde.getTime())
  const huecos = datosGrafico ? huecosDeGrafico(datosGrafico) : { cortes: 0, faltantes: 0 }
  const stats = hayDatos ? estadisticasDeGrafico(datosGrafico!, umbrales) : null
  const promedio = datosGrafico?.resumen.promedio ?? null

  const idsReglas = new Set(alertas.map((a) => a.id))
  const delPeriodo = eventos.filter((e) => {
    const t = new Date(e.medicion_at).getTime()
    const propio = esAvisoDeEquipo(e) || (e.alerta_id !== null && idsReglas.has(e.alerta_id))
    return propio && t >= desde.getTime() && t <= hasta.getTime()
  })

  const ultimasPorSensor = new Map((delPanel?.sensores ?? []).map((s) => [s.id, s]))

  return (
    <div className="flex flex-col">
      {/* Los hermanos del equipo, para saltar de uno a otro sin volver atrás. */}
      <nav aria-label="Sensores del equipo" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-5.5 border-b border-border whitespace-nowrap">
          {sensores.datos.map((s) => {
            const u = ultimasPorSensor.get(s.id)
            const actual = s.id === sensor.id
            return (
              <li key={s.id}>
                <Link
                  to={`/dispositivos/${id}/sensores/${s.id}`}
                  aria-current={actual ? 'page' : undefined}
                  className={`relative block pb-2.5 text-body-lg font-medium transition-colors duration-130 ${
                    actual
                      ? 'text-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent-strong'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {s.etiqueta}
                  {u?.ultimo_valor != null && (
                    <span
                      className={`num ml-1.5 text-note-lg font-medium ${u.disparada ? 'text-danger' : 'text-text-faint'}`}
                    >
                      {medida(u.ultimo_valor, s.unidad)}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-7.5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div role="status" aria-atomic="true">
          <p className="flex items-baseline gap-2">
            <span className="sr-only">{sensor.etiqueta}: </span>
            <b
              className={`num text-alarma leading-none md:text-display ${estado.critico ? 'text-danger' : 'text-text'}`}
            >
              {ultima ? numero(ultima.value) : '—'}
            </b>
            <span className="text-heading-lg text-text-faint md:text-title">{sensor.unidad}</span>
          </p>
          <p className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-lg">
            {estado.glifo && <MarcaEstado estado={estado.glifo} latiendo className="size-2.5" />}
            <b className={`font-semibold ${estado.critico ? 'text-danger' : 'text-text'}`}>
              {estado.texto}
            </b>
            {regla && (
              <span className="text-text-muted">
                umbral {SIMBOLO_CONDICION[regla.condicion]} {medida(regla.umbral, sensor.unidad)}
                {estado.critico &&
                  regla.estado_desde &&
                  ` · desde ${aLas(regla.estado_desde, tic)}`}
              </span>
            )}
          </p>
        </div>
        <Boton
          variante="sutil"
          onClick={() => setExportAbierto(true)}
          className="self-start md:self-auto"
        >
          <IconoExportar className="size-4" />
          Exportar CSV
        </Boton>
      </div>

      {error && <TextoError>No pudimos actualizar: {error}</TextoError>}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <BarraVentana
          ventana={ventana}
          onCambiar={elegir}
          retencionDias={datosGrafico?.retencion_dias ?? null}
          enVivo={enVivo}
          refrescar={polling.refrescar}
          refrescando={polling.refrescando}
          desactualizado={polling.desactualizado}
          hayZoom={hayZoom}
          onRestablecer={restablecer}
        />
        {datosGrafico && (
          <p className="num pb-2 text-note-lg font-normal tracking-normal text-text-faint">
            {datosGrafico.bucket_seg !== null
              ? `Promedio cada ${intervalo(datosGrafico.bucket_seg)}`
              : 'Lecturas sin agregar'}{' '}
            · {datosGrafico.puntos.length} puntos
          </p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-border-control sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-0">
        <Metrica
          etiqueta="Mínimo"
          valor={stats?.minimo ? numero(stats.minimo.valor) : null}
          unidad={sensor.unidad}
          pie={stats?.minimo ? cuando(stats.minimo.t, tic) : undefined}
        />
        <Metrica
          etiqueta="Máximo"
          valor={stats?.maximo ? numero(stats.maximo.valor) : null}
          unidad={sensor.unidad}
          pie={stats?.maximo ? cuando(stats.maximo.t, tic) : undefined}
          critico={
            !!stats?.maximo &&
            umbrales.some((u) => u.condicion === 'mayor' && stats.maximo!.valor > u.umbral)
          }
        />
        <Metrica
          etiqueta="Promedio"
          valor={promedio !== null ? numero(promedio) : null}
          unidad={sensor.unidad}
          pie={nombreDeVentana(ventana)}
        />
        <Metrica
          etiqueta="Fuera de rango"
          valor={
            stats?.fueraDeRango
              ? stats.fueraDeRango.ms > 0
                ? duracionMs(stats.fueraDeRango.ms)
                : '0 min'
              : null
          }
          pie={
            stats?.fueraDeRango
              ? stats.fueraDeRango.veces === 1
                ? '1 vez'
                : `${stats.fueraDeRango.veces} veces`
              : 'sin reglas'
          }
          critico={!!stats?.fueraDeRango?.ms}
        />
        <Metrica
          etiqueta="Sin lecturas"
          valor={stats ? (stats.sinLecturas ? duracionMs(stats.sinLecturas.ms) : '0 min') : null}
          pie={
            stats?.sinLecturas
              ? `el mayor, ${cuando(stats.sinLecturas.desde, tic)}`
              : huecos.faltantes === 0
                ? 'sin cortes'
                : undefined
          }
        />
      </div>

      <div className="mt-6">
        <AvisoVentana
          grafico={datosGrafico}
          primeraConexion={dispositivo.first_connected_at}
          desdePedidoMs={desde.getTime()}
        />
      </div>

      <div
        className={`mt-4 h-72 transition-opacity duration-150 md:h-80 ${polling.desactualizado ? 'opacity-60' : ''}`}
      >
        {hayDatos ? (
          <Grafico
            puntos={grilla}
            color={sensor.color}
            unidad={sensor.unidad}
            etiqueta={sensor.etiqueta}
            desdeMs={limite.desdeMs}
            hastaMs={hastaGrilla}
            corteDePlanMs={limite.corteDePlanMs}
            umbrales={umbrales}
            desdeCero={anclaEnCero(sensor.tipo)}
            onZoom={zoomear}
            onRestablecer={restablecer}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Vacio
              titulo="Sin lecturas para mostrar"
              detalle="El sensor no reportó nada en el rango elegido."
            />
          </div>
        )}
      </div>
      {hayDatos && (
        <div className="mt-2">
          <LeyendaGrafico
            bucketSeg={datosGrafico!.bucket_seg}
            hayUmbral={umbrales.length > 0}
            huecos={huecos}
            hayCorteDePlan={limite.corteDePlanMs !== null}
          />
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="titulo-eventos">
          <h2 id="titulo-eventos" className="flex min-h-10 items-center text-heading-lg">
            Eventos <span className="ml-1.5 font-normal text-text-faint">· este período</span>
          </h2>
          {delPeriodo.length === 0 ? (
            <p className="mt-4 text-body text-text-muted">
              {alertas.length === 0
                ? 'Este sensor no tiene reglas: sólo aparecerían los cortes de conexión del equipo.'
                : 'Ninguna regla cambió de estado y el equipo no se cortó en este período.'}
            </p>
          ) : (
            <LineaDeTiempo eventos={delPeriodo} ahora={tic} conSensor={false} />
          )}
        </section>

        <BloqueHistorial sensorId={sensor.id} unidad={sensor.unidad} umbrales={umbrales} />
      </div>

      {/* Montado sólo mientras está abierto: siembra estado de sus props. */}
      {exportAbierto && (
        <BloqueExport
          dispositivoId={dispositivo.id}
          abierto
          onCerrar={() => setExportAbierto(false)}
        />
      )}
    </div>
  )
}
