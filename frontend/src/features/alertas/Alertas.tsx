import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Banner } from '@/components/ui/Banner'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { BotonIcono } from '@/components/ui/BotonIcono'
import { Card } from '@/components/ui/Card'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoActualizar } from '@/components/layout/iconos'
import { AccionesCabecera, MetaCabecera } from '@/hooks/usarCabecera'
import { useAhora } from '@/hooks/usarAhora'
import { useDispositivos } from '@/features/panel/usarPanel'
import { estadoDispositivo, fecha, TIC_RELOJ_MS } from '@/utils/tiempo'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { etiquetarSensores } from '@/utils/sensores'
import { medida } from '@/utils/formato'
import type { DispositivoResumen } from '@/tipos'
import { FilaEvento } from './FilaEvento'
import { useEventosAlerta } from './usarEventos'

/* El registro de lo que avisó, no el lugar donde se administran las reglas: una
   regla es configuración de un equipo y sólo significa algo al lado de las
   lecturas de su sensor, así que se crea y se edita ahí. Acá se contesta la otra
   pregunta, la que ninguna pantalla de un equipo puede contestar sola: qué pasó,
   en cuál de mis equipos y cuándo. */

/* Lo que está cruzado ahora mismo, un renglón por equipo. Es el estado vivo que
   el registro de abajo no puede dar: ahí cada fila es algo que ya pasó. */
function FilaDisparada({ dispositivo }: { dispositivo: DispositivoResumen }) {
  const etiquetas = etiquetarSensores(dispositivo.sensores)
  const cruzando = dispositivo.sensores.filter((s) => s.disparada)

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-56">
        <MarcaEstado estado="critico" latiendo />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-lg font-medium text-text">
            {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
          </span>
          <span className="truncate text-body text-danger">
            {cruzando.length > 0
              ? cruzando
                  .map((s) => {
                    const etiqueta = etiquetas.get(s.id)?.etiqueta ?? 'Sensor'
                    return s.ultimo_valor === null
                      ? etiqueta
                      : `${etiqueta} ${medida(s.ultimo_valor, s.unidad)}`
                  })
                  .join(' · ')
              : dispositivo.alertas_disparadas === 1
                ? '1 regla cruzada'
                : `${dispositivo.alertas_disparadas} reglas cruzadas`}
          </span>
        </div>
      </div>
      <BotonLink variante="sutil" to={`/dispositivos/${dispositivo.id}`} className="ml-auto">
        Ver equipo
      </BotonLink>
    </li>
  )
}

function EsqueletoFila() {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-4 w-20" />
    </li>
  )
}

export function Alertas() {
  const {
    datos: dispositivos,
    cargando,
    refrescando,
    error,
    refrescar,
    cadenciaSeg,
    actualizadoAt,
  } = useDispositivos()
  const log = useEventosAlerta(cadenciaSeg)

  const ahora = useAhora(
    cadenciaSeg !== undefined ? Math.min(TIC_RELOJ_MS, cadenciaSeg * 1000) : TIC_RELOJ_MS,
  )

  const equipos = dispositivos ?? []
  const enAlerta = equipos.filter((d) => d.alertas_disparadas > 0)
  const disparadas = equipos.reduce((n, d) => n + d.alertas_disparadas, 0)

  /* Un equipo mudo no dispara nada: sus reglas no se están evaluando. Decirlo
     acá no es redundar con el panel — es la pantalla donde alguien se pregunta
     "¿estoy cubierto?", y la respuesta honesta depende de esto. */
  const mudos = equipos.filter((d) => d.activo && estadoDispositivo(d, ahora) === 'sin-reportar')

  const veredicto =
    disparadas === 0
      ? 'Ninguna alerta disparada'
      : disparadas === 1
        ? '1 alerta disparada'
        : `${disparadas} alertas disparadas`

  function actualizar() {
    refrescar()
    log.reiniciar()
  }

  const cabecera = (
    <>
      <MetaCabecera>
        {refrescando ? (
          <span>actualizando…</span>
        ) : actualizadoAt ? (
          <span className="truncate">
            actualizado <HaceCuanto iso={actualizadoAt} />
          </span>
        ) : null}
      </MetaCabecera>
      <AccionesCabecera>
        <BotonIcono etiqueta="Actualizar" onClick={actualizar} disabled={refrescando}>
          <IconoActualizar className="size-4" />
        </BotonIcono>
      </AccionesCabecera>
    </>
  )

  if (cargando) {
    return (
      <div className="flex flex-col gap-6">
        {cabecera}
        <Skeleton className="h-7 w-72" />
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            <EsqueletoFila />
            <EsqueletoFila />
          </ul>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {cabecera}

      <section aria-label="Resumen" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-hero font-semibold text-text">{veredicto}</h2>
        {enAlerta.length > 1 && (
          <span className="text-body text-text-muted">en {enAlerta.length} equipos</span>
        )}
      </section>

      {enAlerta.length > 0 && (
        <section
          aria-label="Alertas disparadas"
          className="overflow-hidden rounded-card border border-danger-border bg-danger-soft"
        >
          <ul className="flex flex-col divide-y divide-danger-border">
            {enAlerta.map((d) => (
              <FilaDisparada key={d.id} dispositivo={d} />
            ))}
          </ul>
        </section>
      )}

      {mudos.length > 0 && (
        <Banner
          tono="atencion"
          titulo={
            mudos.length === 1
              ? `${nombreDeDispositivo(mudos[0].id, mudos[0].nombre)} dejó de reportar`
              : `${mudos.length} equipos dejaron de reportar`
          }
          acciones={
            mudos.length === 1 ? (
              <BotonLink variante="sutil" to={`/dispositivos/${mudos[0].id}`}>
                Ver equipo
              </BotonLink>
            ) : undefined
          }
        >
          Mientras un equipo está mudo no se evalúa ninguna de sus reglas, así que lo de abajo no
          dice nada sobre lo que esté pasando ahí.
          {/* Con varios no hay un "ver equipo" que sirva: cada uno es su propia
              visita, así que la lista misma es la navegación. */}
          {mudos.length > 1 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {mudos.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/dispositivos/${d.id}`}
                    className="font-medium text-text hover:underline"
                  >
                    {nombreDeDispositivo(d.id, d.nombre)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Banner>
      )}

      {/* Un fallo de poll con datos en pantalla es un aviso al costado: la última
          foto buena sigue sirviendo. */}
      {error && dispositivos && <TextoError>No pudimos actualizar: {error}</TextoError>}

      <section aria-label="Registro de avisos">
        <Card>
          {log.cargando ? (
            <ul className="flex flex-col divide-y divide-border">
              <EsqueletoFila />
              <EsqueletoFila />
              <EsqueletoFila />
            </ul>
          ) : log.error && log.eventos.length === 0 ? (
            <Vacio
              titulo="No pudimos cargar el registro"
              detalle={log.error}
              accion={
                <Boton variante="sutil" onClick={log.reiniciar}>
                  Reintentar
                </Boton>
              }
            />
          ) : log.eventos.length === 0 ? (
            <Vacio
              titulo="Sin avisos todavía"
              detalle="Acá van a aparecer los cruces de umbral de todos tus equipos y los cortes de los que dejan de reportar, con el valor o la duración y a qué hora."
            />
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border">
                {log.eventos.map((evento, i) => {
                  const dia = fecha(evento.medicion_at)
                  const abreDia = i === 0 || fecha(log.eventos[i - 1].medicion_at) !== dia
                  return (
                    <Fragment key={evento.id}>
                      {abreDia && (
                        <li className="num bg-surface-2 px-4 py-1.5 text-note font-semibold tracking-wide text-text-faint uppercase sm:px-5">
                          {dia}
                        </li>
                      )}
                      <FilaEvento evento={evento} />
                    </Fragment>
                  )
                })}
              </ul>

              {log.error && (
                <div className="px-4 pt-3 sm:px-5">
                  <TextoError>No pudimos actualizar el registro: {log.error}</TextoError>
                </div>
              )}

              {/* Se lee hacia atrás y de a poco: lo que hace falta es seguir
                  bajando, no saltar a una página cualquiera. */}
              {log.hayMas && (
                <div className="flex justify-center border-t border-border px-5 py-3">
                  <Boton variante="sutil" disabled={log.cargandoMas} onClick={log.cargarMas}>
                    {log.cargandoMas ? 'Cargando…' : 'Cargar avisos anteriores'}
                  </Boton>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      <p className="max-w-125 text-note-lg text-text-faint">
        Las reglas se crean y se editan en cada equipo, al lado de las lecturas del sensor. Los
        avisos de «dejó de reportar» no se configuran: cada equipo se vigila solo, y quien no los
        quiera por mail puede silenciarlo desde sus ajustes.
      </p>
    </div>
  )
}
