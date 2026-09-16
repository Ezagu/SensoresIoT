import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MarcaEstado, type Estado } from '@/components/ui/MarcaEstado'
import { Pill } from '@/components/ui/Pill'
import { SIMBOLO_CONDICION } from '@/features/dispositivo/alertas/condicion'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { etiquetaDeTipo } from '@/utils/sensores'
import { medida } from '@/utils/formato'
import { duracion, horaSegundos } from '@/utils/tiempo'
import { esAvisoDeEquipo, type AlertaEvento, type AvisoDeEquipo, type AvisoDeRegla } from '@/tipos'

/* Dos formas de aviso comparten el renglón porque comparten la pregunta —qué
   pasó, en cuál de mis equipos y cuándo— y la atención es una sola cola. Lo que
   cambia es contra qué se juzga: una regla contra su umbral, un corte contra
   cuánto duró. */

/* Angosto, qué pasó se lleva el primer renglón entero y la comparación baja
   junto con la hora: recortar el nombre del equipo para que la cifra entre al
   lado deja ilegibles a los dos. */
function Renglon({
  estado,
  titulo,
  detalle,
  cifra,
  extra,
  medicionAt,
}: {
  estado: Estado
  titulo: string
  detalle: ReactNode
  cifra: ReactNode
  extra?: ReactNode
  medicionAt: string
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:px-5">
      <div className="flex min-w-0 flex-1 basis-full items-center gap-4 sm:basis-56">
        {/* La forma dice qué pasó; el color es refuerzo. Sin latido: esto ya
            pasó, y lo que está sonando ahora vive en la banda de arriba. */}
        <MarcaEstado estado={estado} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-lg font-medium text-text">{titulo}</span>
          <span className="truncate text-note-lg text-text-muted">{detalle}</span>
        </div>
      </div>

      <span className="num shrink-0 text-note-lg text-text-muted">{cifra}</span>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {extra}
        <span className="num text-note-lg text-text-faint">{horaSegundos(medicionAt)}</span>
      </span>
    </li>
  )
}

function Equipo({ evento }: { evento: AlertaEvento }) {
  return (
    <Link
      to={`/dispositivos/${evento.dispositivo_id}`}
      className="hover:text-text hover:underline"
    >
      {nombreDeDispositivo(evento.dispositivo_id, evento.dispositivo_nombre)}
    </Link>
  )
}

/* Sólo cuando el mail tenía que salir y no salió. Cero destinatarios no es una
   falla: de un lote se avisa la última transición de cada regla, así que un
   envío diferido que oscila deja el resto como historial, y un equipo silenciado
   no tiene a quién avisarle. */
function NoSePudoAvisar({ evento }: { evento: AlertaEvento }) {
  if (evento.destinatarios === 0 || evento.notificados > 0) return null
  return (
    <span className="text-warn" title="El aviso se registró pero el mail no llegó a salir.">
      {' · '}no se pudo avisar
    </span>
  )
}

function FilaDeRegla({ evento }: { evento: AvisoDeRegla }) {
  const disparada = evento.tipo === 'disparada'
  const sensor = etiquetaDeTipo(evento.tipo_sensor_nombre)
  const unidad = evento.tipo_sensor_unidad
  const corte = `${SIMBOLO_CONDICION[evento.condicion]} ${medida(evento.umbral, unidad)}`

  return (
    <Renglon
      estado={disparada ? 'critico' : 'normal'}
      titulo={evento.alerta_nombre?.trim() || `${sensor} ${corte}`}
      detalle={
        <>
          <Equipo evento={evento} />
          {' · '}
          {sensor}
          {' · '}
          {disparada ? 'se disparó' : 'volvió a normal'}
          <NoSePudoAvisar evento={evento} />
        </>
      }
      cifra={
        <>
          <span className="font-medium text-text">{medida(evento.valor, unidad)}</span> umbral {corte}
        </>
      }
      extra={
        evento.tardio && (
          <Pill tono="atencion">
            <span title="Llegó en un envío diferido: el equipo guardó la lectura sin conexión y la mandó al reconectar. Se evaluó igual.">
              tardío
            </span>
          </Pill>
        )
      }
      medicionAt={evento.medicion_at}
    />
  )
}

function FilaDeEquipo({ evento }: { evento: AvisoDeEquipo }) {
  const corte = evento.tipo === 'sin_reportar'
  const silencio = duracion(evento.silencio_desde, evento.medicion_at)

  return (
    <Renglon
      /* El mismo glifo que la pastilla del equipo: un corte acá y "Sin reportar"
         en el panel son el mismo hecho contado en dos lados. */
      estado={corte ? 'sin-reportar' : 'normal'}
      titulo={nombreDeDispositivo(evento.dispositivo_id, evento.dispositivo_nombre)}
      detalle={
        <>
          <Equipo evento={evento} />
          {' · '}
          {corte ? 'dejó de reportar' : 'volvió a reportar'}
          <NoSePudoAvisar evento={evento} />
        </>
      }
      /* Un corte no tiene valor contra qué compararse: lo único que se juzga es
         cuánto duró. En el de apertura, cuánto llevaba al detectarlo. */
      cifra={
        <>
          <span className="font-medium text-text">{silencio}</span> {corte ? 'sin datos' : 'de corte'}
        </>
      }
      medicionAt={evento.medicion_at}
    />
  )
}

export function FilaEvento({ evento }: { evento: AlertaEvento }) {
  return esAvisoDeEquipo(evento) ? <FilaDeEquipo evento={evento} /> : <FilaDeRegla evento={evento} />
}
