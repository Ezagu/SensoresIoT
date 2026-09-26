import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MarcaEstado, type Estado } from '@/components/ui/MarcaEstado'
import { IconoChevron } from '@/components/layout/iconos'
import { SIMBOLO_CONDICION } from '@/features/dispositivo/alertas/condicion'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { etiquetaDeTipo } from '@/utils/sensores'
import { medida } from '@/utils/formato'
import { duracion, hora } from '@/utils/tiempo'
import { esAvisoDeEquipo, type AlertaEvento } from '@/tipos'

function personas(n: number) {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`
}

/* A quién le llegó el mail. Un envío fallido no se le muestra al usuario: no
   tiene cómo arreglarlo, es un problema del backend. */
function Notificacion({ evento }: { evento: AlertaEvento }) {
  return (
    <div className="flex flex-col gap-0.5 text-body text-text-muted">
      {evento.notificados > 0 ? (
        <span>Email a {personas(evento.notificados)}</span>
      ) : (
        <span>Sin aviso por email</span>
      )}
      {evento.tardio && (
        <span
          className="text-note text-text-faint"
          title="Llegó en un envío diferido: el equipo guardó la lectura sin conexión y la mandó al reconectar. Se evaluó igual."
        >
          Llegó con demora, a las {hora(new Date(evento.detectado_at).getTime())}
        </span>
      )}
    </div>
  )
}

function Renglon({
  evento,
  glifo,
  titulo,
  critico,
  equipo,
  valor,
  pie,
}: {
  evento: AlertaEvento
  glifo: Estado
  titulo: string
  critico: boolean
  equipo: string
  valor: ReactNode
  pie: string
}) {
  const a = `/dispositivos/${evento.dispositivo_id}`
  return (
    <li className="grid grid-cols-[3rem_1.125rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-border py-4 md:grid-cols-[3.5rem_1.125rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7rem] md:gap-x-4">
      <span className="num pt-px text-label-lg font-medium text-text-muted">
        {hora(new Date(evento.medicion_at).getTime())}
      </span>
      <span className="flex justify-center pt-1.5">
        {/* Sin latido: esto ya pasó. Lo que suena ahora está en la banda de arriba. */}
        <MarcaEstado estado={glifo} />
      </span>
      <div className="min-w-0">
        <p
          className={`truncate text-body-lg font-semibold ${critico ? 'text-danger' : 'text-text'}`}
        >
          {titulo}
        </p>
        <p className="mt-0.5 truncate text-body text-text-muted">{equipo}</p>
      </div>
      <p
        className={`num col-start-3 text-body-lg md:col-start-auto ${critico ? 'text-danger' : 'text-text'}`}
      >
        {valor}
        <small className="block text-note font-medium tracking-normal text-text-faint">{pie}</small>
      </p>
      <div className="col-start-3 md:col-start-auto">
        <Notificacion evento={evento} />
      </div>
      <Link
        to={a}
        className="col-start-3 inline-flex items-center gap-1 justify-self-start pt-px text-body font-medium text-accent hover:text-text md:col-start-auto md:justify-self-end"
      >
        Ver equipo
        <IconoChevron className="size-3.5 md:hidden" />
      </Link>
    </li>
  )
}

/* Dos formas de aviso en un renglón: comparten la pregunta —qué pasó, en cuál
   de mis equipos y cuándo—. Lo que cambia es contra qué se juzga: una regla
   contra su umbral, un corte contra cuánto duró. `anteriores` son los más
   viejos ya cargados: de ahí sale cuánto duró un cruce. */
export function FilaEvento({
  evento,
  anteriores,
}: {
  evento: AlertaEvento
  anteriores: AlertaEvento[]
}) {
  const nombre = nombreDeDispositivo(evento.dispositivo_id, evento.dispositivo_nombre)

  if (esAvisoDeEquipo(evento)) {
    const corte = evento.tipo === 'sin_reportar'
    return (
      <Renglon
        evento={evento}
        glifo={corte ? 'sin-reportar' : 'normal'}
        titulo={corte ? 'Dejó de reportar' : 'Volvió a reportar'}
        critico={false}
        equipo={nombre}
        valor={
          corte
            ? hora(new Date(evento.silencio_desde).getTime())
            : duracion(evento.silencio_desde, evento.medicion_at)
        }
        pie={corte ? 'última lectura' : 'sin reportar'}
      />
    )
  }

  const sensor = etiquetaDeTipo(evento.tipo_sensor_nombre)
  const unidad = evento.tipo_sensor_unidad
  const corte = `${SIMBOLO_CONDICION[evento.condicion]} ${medida(evento.umbral, unidad)}`

  if (evento.tipo === 'disparada') {
    return (
      <Renglon
        evento={evento}
        glifo="critico"
        titulo={evento.alerta_nombre?.trim() || `${sensor} ${corte}`}
        critico
        equipo={evento.alerta_nombre ? `${nombre} · ${sensor}` : nombre}
        valor={medida(evento.valor, unidad)}
        pie={`umbral ${corte}`}
      />
    )
  }

  const disparo = anteriores.find(
    (a) => !esAvisoDeEquipo(a) && a.tipo === 'disparada' && a.alerta_id === evento.alerta_id,
  )
  return (
    <Renglon
      evento={evento}
      glifo="normal"
      titulo="Volvió a rango"
      critico={false}
      equipo={`${nombre} · ${evento.alerta_nombre?.trim() || sensor}`}
      valor={medida(evento.valor, unidad)}
      pie={
        disparo ? `duró ${duracion(disparo.medicion_at, evento.medicion_at)}` : `umbral ${corte}`
      }
    />
  )
}
