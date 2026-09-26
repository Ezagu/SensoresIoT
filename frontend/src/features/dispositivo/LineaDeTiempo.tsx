import { Fragment } from 'react'
import { MarcaEstado, type Estado } from '@/components/ui/MarcaEstado'
import { esAvisoDeEquipo, type AlertaEvento } from '@/tipos'
import { medida } from '@/utils/formato'
import { etiquetaDeTipo } from '@/utils/sensores'
import { duracion, fechaCorta, hora } from '@/utils/tiempo'

function personas(n: number) {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`
}

/* Sólo "no se pudo" con destinatarios y ningún envío: de un lote se notifica
   la última transición de cada regla, y el resto tiene 0 destinatarios. */
function aviso(e: AlertaEvento): string | null {
  if (e.destinatarios === 0) return null
  if (e.notificados === 0) return 'no se pudo avisar'
  return `email a ${personas(e.notificados)}`
}

function dia(ms: number, ahora: number): string {
  const inicio = (x: number) => new Date(x).setHours(0, 0, 0, 0)
  const dias = Math.round((inicio(ahora) - inicio(ms)) / 86_400_000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return fechaCorta(ms)
}

type Renglon = { glifo: Estado; titulo: string; detalle: string[]; critico: boolean }

/* `anteriores` son los eventos más viejos de la misma lista: de ahí sale cuánto
   duró un cruce cuando la vuelta a rango llega con su disparo a la vista. */
function renglon(e: AlertaEvento, anteriores: AlertaEvento[], conSensor: boolean): Renglon {
  const mail = aviso(e)
  if (esAvisoDeEquipo(e)) {
    if (e.tipo === 'sin_reportar') {
      return {
        glifo: 'sin-reportar',
        titulo: 'Dejó de reportar',
        detalle: [
          `sin datos desde las ${hora(new Date(e.silencio_desde).getTime())}`,
          ...(mail ? [mail] : []),
        ],
        critico: false,
      }
    }
    return {
      glifo: 'normal',
      titulo: 'Volvió a reportar',
      detalle: [`corte de ${duracion(e.silencio_desde, e.medicion_at)}`],
      critico: false,
    }
  }

  const sensor = conSensor ? `${etiquetaDeTipo(e.tipo_sensor_nombre)} ` : ''
  const valor = medida(e.valor, e.tipo_sensor_unidad)
  if (e.tipo === 'disparada') {
    const lado = e.condicion === 'mayor' ? 'sobre' : 'bajo'
    const titulo = `${sensor}${lado} ${medida(e.umbral, e.tipo_sensor_unidad)}`
    return {
      glifo: 'critico',
      titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1),
      detalle: [valor, ...(mail ? [mail] : [])],
      critico: true,
    }
  }
  const disparo = anteriores.find(
    (a) => !esAvisoDeEquipo(a) && a.tipo === 'disparada' && a.alerta_id === e.alerta_id,
  )
  return {
    glifo: 'normal',
    titulo: `${conSensor ? `${etiquetaDeTipo(e.tipo_sensor_nombre)} volvió` : 'Volvió'} a rango`,
    detalle: [valor, ...(disparo ? [`duró ${duracion(disparo.medicion_at, e.medicion_at)}`] : [])],
    critico: false,
  }
}

/* Lo que le pasó al equipo, del más nuevo al más viejo, con la hora a la
   izquierda y un separador por día. */
export function LineaDeTiempo({
  eventos,
  ahora,
  conSensor = true,
}: {
  eventos: AlertaEvento[]
  ahora: number
  /* En el detalle de un sensor ya se sabe de cuál se habla. */
  conSensor?: boolean
}) {
  let diaPrevio = dia(ahora, ahora)

  return (
    <ol className="mt-4 flex flex-col">
      {eventos.map((e, i) => {
        const ms = new Date(e.medicion_at).getTime()
        const diaEvento = dia(ms, ahora)
        const separador = diaEvento !== diaPrevio
        diaPrevio = diaEvento
        const r = renglon(e, eventos.slice(i + 1), conSensor)

        return (
          <Fragment key={e.id}>
            {separador && (
              <li className="grid grid-cols-[2.75rem_1.125rem_minmax(0,1fr)] gap-3">
                <span />
                <span className="relative before:absolute before:inset-y-0 before:left-1/2 before:w-px before:bg-border-control" />
                <span className="micro py-2.5">{diaEvento}</span>
              </li>
            )}
            <li className="grid grid-cols-[2.75rem_1.125rem_minmax(0,1fr)] gap-3">
              <span className="num pt-2.5 text-right text-body font-medium text-text-muted">
                {hora(ms)}
              </span>
              <span className="relative flex justify-center pt-3.75 before:absolute before:inset-y-0 before:left-1/2 before:w-px before:bg-border-control">
                <span className="relative bg-bg py-0.5">
                  <MarcaEstado estado={r.glifo} />
                </span>
              </span>
              <span className="min-w-0 py-2.25">
                <span
                  className={`block text-body-lg font-medium ${r.critico ? 'text-danger' : 'text-text'}`}
                >
                  {r.titulo}
                </span>
                <span className="mt-0.5 block text-note-lg text-text-muted">
                  {r.detalle.map((d, j) => (
                    <Fragment key={j}>
                      {j > 0 && ' · '}
                      {j === 0 && !esAvisoDeEquipo(e) ? (
                        <b className="num font-semibold text-text">{d}</b>
                      ) : (
                        d
                      )}
                    </Fragment>
                  ))}
                  {e.tardio && ' · llegó con demora'}
                </span>
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
