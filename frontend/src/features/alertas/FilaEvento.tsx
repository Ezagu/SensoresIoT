import { Link } from 'react-router-dom'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { Pill } from '@/components/ui/Pill'
import { SIMBOLO_CONDICION } from '@/features/dispositivo/alertas/condicion'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { etiquetaDeTipo } from '@/utils/sensores'
import { medida } from '@/utils/formato'
import { horaSegundos } from '@/utils/tiempo'
import type { AlertaEvento } from '@/tipos'

/* Una transición de una regla. Siempre el valor contra su umbral: sin eso el
   evento no se puede juzgar, y volver al equipo para averiguarlo es justo lo
   que este registro viene a evitar. */
export function FilaEvento({ evento }: { evento: AlertaEvento }) {
  const disparada = evento.tipo === 'disparada'
  const sensor = etiquetaDeTipo(evento.tipo_sensor_nombre)
  const unidad = evento.tipo_sensor_unidad
  const corte = `${SIMBOLO_CONDICION[evento.condicion]} ${medida(evento.umbral, unidad)}`

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:px-5">
      {/* Angosto, qué pasó se lleva el primer renglón entero y la comparación
          baja junto con la hora: recortar el nombre del equipo para que el valor
          entre al lado deja ilegibles a los dos. */}
      <div className="flex min-w-0 flex-1 basis-full items-center gap-4 sm:basis-56">
        {/* La forma dice qué pasó; el color es refuerzo. Sin latido: esto ya
            pasó, y lo que está sonando ahora vive en la banda de arriba. */}
        <MarcaEstado estado={disparada ? 'critico' : 'normal'} />

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-lg font-medium text-text">
            {evento.alerta_nombre?.trim() || `${sensor} ${corte}`}
          </span>
          <span className="truncate text-note-lg text-text-muted">
            <Link
              to={`/dispositivos/${evento.dispositivo_id}`}
              className="hover:text-text hover:underline"
            >
              {nombreDeDispositivo(evento.dispositivo_id, evento.dispositivo_nombre)}
            </Link>
            {' · '}
            {sensor}
            {' · '}
            {disparada ? 'se disparó' : 'volvió a normal'}
            {/* Sólo cuando el mail tenía que salir y no salió. Cero
                destinatarios no es una falla: de un lote se avisa la última
                transición de cada regla, así que un envío diferido que oscila
                deja el resto como historial, y un equipo silenciado no tiene a
                quién avisarle. */}
            {evento.destinatarios > 0 && evento.notificados === 0 && (
              <span className="text-warn" title="La alerta se registró pero el mail no llegó a salir.">
                {' · '}no se pudo avisar
              </span>
            )}
          </span>
        </div>
      </div>

      <span className="num shrink-0 text-note-lg text-text-muted">
        <span className="font-medium text-text">{medida(evento.valor, unidad)}</span> umbral {corte}
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {evento.tardio && (
          <Pill tono="atencion">
            <span title="Llegó en un envío diferido: el equipo guardó la lectura sin conexión y la mandó al reconectar. Se evaluó igual.">
              tardío
            </span>
          </Pill>
        )}
        <span className="num text-note-lg text-text-faint">{horaSegundos(evento.medicion_at)}</span>
      </span>
    </li>
  )
}
