import { Link } from 'react-router-dom'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { IconoSensor } from '@/components/ui/IconoSensor'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { IconoChevron } from '@/components/layout/iconos'
import type { FilaCartera } from '@/components/layout/ListaEquipos'
import type { SensorResumen } from '@/tipos'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { numero } from '@/utils/formato'
import { etiquetarSensores } from '@/utils/sensores'
import { estadoDispositivo, haceCuanto } from '@/utils/tiempo'

const VISIBLES = 4

function enumerar(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

/* El renglón de abajo del nombre: el estado con el dato que lo sostiene. */
function Subtitulo({ fila, ahora }: { fila: FilaCartera; ahora: number }) {
  const { dispositivo: d, situacion } = fila
  if (situacion.glifo === 'atencion' && situacion.tono === 'attention') {
    return <p className="mt-0.5 pl-4.5 text-note-lg text-attention">Atención · {situacion.texto}</p>
  }
  const conectividad = estadoDispositivo(d, ahora)
  return (
    <p className="mt-0.5 truncate pl-4.5 text-note-lg text-text-faint">
      {!d.activo ? (
        'Desactivado'
      ) : conectividad === 'nunca' ? (
        'Nunca reportó'
      ) : conectividad === 'con-retraso' ? (
        <>
          Con retraso · última lectura <HaceCuanto iso={d.last_data_at} />
        </>
      ) : (
        <>
          En línea · <HaceCuanto iso={d.last_data_at ?? d.last_seen_at} />
        </>
      )}
    </p>
  )
}

function Lectura({
  sensor,
  etiqueta,
  solo,
  mudo,
  ahora,
}: {
  sensor: SensorResumen
  etiqueta: string
  solo: boolean
  mudo: boolean
  ahora: number
}) {
  return (
    <div className={`min-w-0 border-t border-border pt-2.75 pb-0.5 ${solo ? 'col-span-full' : ''}`}>
      <div className="flex items-center gap-1.5 truncate text-note-lg text-text-muted">
        <span className="text-text-faint">
          <IconoSensor tipo={sensor.tipo_nombre} />
        </span>
        {etiqueta}
      </div>
      <div className="mt-0.75 flex items-baseline gap-1.25">
        <b
          className={`num ${solo ? 'text-metric-lg' : 'text-metric'} ${mudo ? 'text-text-faint' : 'text-text'}`}
        >
          {sensor.ultimo_valor !== null ? numero(sensor.ultimo_valor) : '—'}
        </b>
        <small className="text-note font-medium text-text-faint">{sensor.unidad}</small>
        {mudo && sensor.ultimo_at && (
          <span className="ml-1 truncate text-note text-attention">
            {haceCuanto(sensor.ultimo_at, ahora)}
          </span>
        )}
      </div>
    </div>
  )
}

/* Autónoma: sólo los sensores que el equipo tiene, sin columnas compartidas con
   el resto de la grilla. El que tiene el problema va primero; el resto, en el
   orden del equipo. */
export function TarjetaEquipo({ fila, ahora }: { fila: FilaCartera; ahora: number }) {
  const { dispositivo: d, situacion } = fila
  const etiquetas = etiquetarSensores(d.sensores)
  const ordenados = situacion.sensorId
    ? [...d.sensores].sort(
        (a, b) => Number(b.id === situacion.sensorId) - Number(a.id === situacion.sensorId),
      )
    : d.sensores
  const visibles = ordenados.slice(0, VISIBLES)
  const resto = ordenados.slice(VISIBLES)

  return (
    <Link
      to={`/dispositivos/${d.id}`}
      className={`flex flex-col rounded-card border px-5 pt-4.5 pb-4 transition-colors duration-130 hover:border-accent-border ${
        situacion.requiereAtencion ? 'border-attention-border' : 'border-border-control'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <MarcaEstado estado={situacion.glifo} />
        <span className="min-w-0 flex-1 truncate text-heading font-semibold">
          {nombreDeDispositivo(d.id, d.nombre)}
        </span>
        <IconoChevron className="size-4 shrink-0 text-text-faint" />
      </div>
      <Subtitulo fila={fila} ahora={ahora} />

      {visibles.length > 0 && (
        <div className="mt-3.5 grid grid-cols-2 gap-x-4">
          {visibles.map((s) => (
            <Lectura
              key={s.id}
              sensor={s}
              etiqueta={etiquetas.get(s.id)!.etiqueta}
              solo={visibles.length === 1}
              mudo={s.id === situacion.sensorId && situacion.tono === 'attention'}
              ahora={ahora}
            />
          ))}
        </div>
      )}

      {resto.length > 0 && (
        <p className="mt-auto truncate pt-3.5 text-note text-text-faint">
          <b className="font-medium text-text-muted">
            {resto.length === 1 ? '1 sensor más:' : `${resto.length} sensores más:`}
          </b>{' '}
          {enumerar(resto.map((s) => etiquetas.get(s.id)!.etiqueta))}
        </p>
      )}
    </Link>
  )
}
