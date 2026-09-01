import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Pill, TONO_POR_ESTADO } from '@/components/ui/Pill'
import { Tira } from '@/components/graficos/Tira'
import { IconoAlerta, IconoChevron, IconoUbicacion } from '@/components/layout/iconos'
import { medida } from '@/lib/formato'
import { ETIQUETA_ESTADO, haceCuanto, type EstadoDispositivo } from '@/lib/tiempo'
import type { Equipo, SensorPanel } from '@/lib/equipos'

/* El equipo puede no tener nombre cargado: el id corto lo distingue del resto
   sin obligar a mostrar un UUID entero. */
function nombreDe(id: string, nombre: string | null) {
  return nombre?.trim() || `Equipo ${id.slice(0, 8)}`
}

function Fila({ sensor }: { sensor: SensorPanel }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-text-muted">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: sensor.color }}
          />
          <span className="truncate">{sensor.etiqueta}</span>
          {sensor.disparada && <IconoAlerta className="size-3.25 shrink-0 text-danger" />}
        </span>
        <span
          className={`num shrink-0 text-[15px] font-semibold ${sensor.disparada ? 'text-danger' : ''}`}
        >
          {sensor.ultimo === null ? '—' : medida(sensor.ultimo, sensor.unidad)}
        </span>
      </div>
      <div className="h-8">
        {sensor.serie.length > 0 ? (
          <Tira
            valores={sensor.serie}
            color={sensor.color}
            umbral={sensor.umbral}
            condicion={sensor.condicion}
          />
        ) : (
          <p className="pt-1.5 text-[11px] text-text-faint">Sin lecturas en las últimas 24 h</p>
        )}
      </div>
    </li>
  )
}

export function TarjetaEquipo({ equipo, estado }: { equipo: Equipo; estado: EstadoDispositivo }) {
  const { dispositivo, sensores, incompleto } = equipo
  const inactivo = !dispositivo.activo

  return (
    <Card className="flex h-full flex-col gap-3 p-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col">
          <Link
            to={`/equipos/${dispositivo.id}`}
            className="truncate font-display text-[14px] font-semibold text-text hover:text-accent"
          >
            {nombreDe(dispositivo.id, dispositivo.nombre)}
          </Link>
          {dispositivo.ubicacion && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11.5px] text-text-faint">
              <IconoUbicacion className="size-3.25 shrink-0" />
              <span className="truncate">{dispositivo.ubicacion}</span>
            </span>
          )}
        </div>
        {/* Un equipo dado de baja no tiene estado de conexión que informar */}
        {inactivo ? (
          <Pill tono="faint">Desactivado</Pill>
        ) : (
          <Pill tono={TONO_POR_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Pill>
        )}
      </div>

      {incompleto ? (
        <p className="text-[12px] text-text-faint">No pudimos leer los sensores de este equipo.</p>
      ) : sensores.length === 0 ? (
        <p className="text-[12px] text-text-faint">Este equipo todavía no tiene sensores.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sensores.map((s) => (
            <Fila key={s.id} sensor={s} />
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] text-text-faint">
        <span className="truncate">
          {dispositivo.last_seen_at ? `Reportó ${haceCuanto(dispositivo.last_seen_at)}` : 'Nunca reportó'}
        </span>
        <Link
          to={`/equipos/${dispositivo.id}`}
          className="flex shrink-0 items-center gap-0.5 font-medium text-accent hover:underline"
        >
          Ver detalle
          <IconoChevron className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}
