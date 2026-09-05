import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Pill, TONO_POR_ESTADO } from '@/components/ui/Pill'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { IconoAlertaSonando, IconoChevron, IconoUbicacion } from '@/components/layout/iconos'
import { medida } from '@/lib/formato'
import { ETIQUETA_ESTADO, estadoDispositivo, type EstadoDispositivo } from '@/lib/tiempo'
import { nombreDeDispositivo } from '@/lib/dispositivos'
import type { DispositivoPanel, SensorPanel } from './usarPanel'

/* 'retraso' no apaga la fila: arranca a 3 intervalos y estos dispositivos
   pierden WiFi y se ponen al día solos, así que apagarla ahí la haría parpadear
   por algo que casi nunca es una falla. */
const ESTADOS_APAGADOS: EstadoDispositivo[] = ['sin-reportar', 'nunca']

/* Desactualizado: el hue del sensor y el valor se apagan a gris, para que el
   número se siga leyendo pero no como una lectura de ahora. El ícono de alerta
   no se apaga: es el estado de una regla, no una medición. */
function Fila({ sensor, desactualizado }: { sensor: SensorPanel; desactualizado: boolean }) {
  const tonoValor = desactualizado
    ? 'text-text-muted'
    : sensor.disparada
      ? 'text-danger'
      : 'text-text'

  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5 text-label text-text-muted">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${desactualizado ? 'bg-text-faint' : ''}`}
          style={desactualizado ? undefined : { background: sensor.color }}
        />
        <span className="truncate">{sensor.etiqueta}</span>
        {sensor.disparada && <IconoAlertaSonando className="size-3.25 shrink-0 text-danger" />}
      </span>
      <span className={`num shrink-0 text-heading-lg font-semibold ${tonoValor}`}>
        {sensor.ultimo === null ? '—' : medida(sensor.ultimo, sensor.unidad)}
      </span>
    </li>
  )
}

export function TarjetaDispositivo({
  datos,
  estado,
  intervaloSeg,
  ahora,
}: {
  datos: DispositivoPanel
  estado: EstadoDispositivo
  intervaloSeg: number
  ahora: number
}) {
  const { dispositivo, sensores } = datos
  const inactivo = !dispositivo.activo

  /* Por sensor y no por dispositivo: el pill de arriba habla del equipo, pero
     cada lectura tiene su propia antigüedad. */
  const estaDesactualizado = (sensor: SensorPanel) =>
    inactivo || ESTADOS_APAGADOS.includes(estadoDispositivo(sensor.ultimoAt, intervaloSeg, ahora))

  return (
    <Card className="flex h-full flex-col gap-3 p-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col">
          <Link
            to={`/dispositivos/${dispositivo.id}`}
            className="truncate font-display text-heading font-semibold text-text hover:text-accent"
          >
            {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
          </Link>
          {dispositivo.ubicacion && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-note-lg text-text-faint">
              <IconoUbicacion className="size-3.25 shrink-0" />
              <span className="truncate">{dispositivo.ubicacion}</span>
            </span>
          )}
        </div>
        {/* Un dispositivo dado de baja no tiene estado de conexión que informar */}
        {inactivo ? (
          <Pill tono="faint">Desactivado</Pill>
        ) : (
          <Pill tono={TONO_POR_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Pill>
        )}
      </div>

      {sensores.length === 0 ? (
        <p className="text-label text-text-faint">Este dispositivo todavía no tiene sensores.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sensores.map((s) => (
            <Fila key={s.id} sensor={s} desactualizado={estaDesactualizado(s)} />
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5 text-note text-text-faint">
        <span className="truncate">
          {dispositivo.last_seen_at ? (
            <>Reportó <HaceCuanto iso={dispositivo.last_seen_at} /></>
          ) : (
            'Nunca reportó'
          )}
        </span>
        <Link
          to={`/dispositivos/${dispositivo.id}`}
          className="flex shrink-0 items-center gap-0.5 font-medium text-accent hover:underline"
        >
          Ver detalle
          <IconoChevron className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}
