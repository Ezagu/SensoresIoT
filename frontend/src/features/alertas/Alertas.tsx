import { Fragment } from 'react'
import { Boton } from '@/components/ui/Boton'
import { BotonIcono } from '@/components/ui/BotonIcono'
import { Card } from '@/components/ui/Card'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoActualizar } from '@/components/layout/iconos'
import { AccionesCabecera, MetaCabecera } from '@/hooks/usarCabecera'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { fecha } from '@/utils/tiempo'
import { FilaEvento } from './FilaEvento'
import { useEventosAlerta } from './usarEventos'

/* El registro de lo que avisó, no el lugar donde se administran las reglas: una
   regla es configuración de un equipo y sólo significa algo al lado de las
   lecturas de su sensor, así que se crea y se edita ahí. Lo que está cruzado
   ahora mismo ya lo dice el panel — acá sólo el historial: qué pasó, en cuál
   de mis equipos y cuándo. */

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
  // Sólo para la cadencia del equipo más rápido de la cartera, que gobierna el
  // poll del registro (ver usarEventos): nada de la cartera se dibuja acá.
  const { cadenciaSeg, refrescar: refrescarCadencia } = useDispositivos()
  const log = useEventosAlerta(cadenciaSeg)

  function actualizar() {
    refrescarCadencia()
    log.reiniciar()
  }

  const cabecera = (
    <>
      <MetaCabecera>
        {log.cargandoMas ? (
          <span>actualizando…</span>
        ) : log.actualizadoAt ? (
          <span className="truncate">
            actualizado <HaceCuanto iso={log.actualizadoAt} />
          </span>
        ) : null}
      </MetaCabecera>
      <AccionesCabecera>
        <BotonIcono etiqueta="Actualizar" onClick={actualizar} disabled={log.cargandoMas}>
          <IconoActualizar className="size-4" />
        </BotonIcono>
      </AccionesCabecera>
    </>
  )

  if (log.cargando) {
    return (
      <div className="flex flex-col gap-6">
        {cabecera}
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            <EsqueletoFila />
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

      <section aria-label="Registro de avisos">
        <Card>
          {log.error && log.eventos.length === 0 ? (
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
