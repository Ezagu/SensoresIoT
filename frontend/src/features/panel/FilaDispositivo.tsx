import { Link } from 'react-router-dom'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Lectura } from '@/components/ui/Lectura'
import { PillConteo } from '@/components/ui/Pill'
import { PastillaEstado } from '@/components/ui/PastillaEstado'
import { type Estado } from '@/components/ui/MarcaEstado'
import { IconoChevron, IconoUbicacion } from '@/components/layout/iconos'
import { lecturaDesactualizada, type EstadoDispositivo } from '@/utils/tiempo'
import { estadoDeFila, nombreDeDispositivo } from '@/utils/dispositivos'
import { etiquetarSensores } from '@/utils/sensores'
import type { DispositivoResumen, SensorResumen } from '@/tipos'

/* El rail sólo se pinta cuando la fila pide algo. En estado normal no lleva
   color: la calma es la ausencia de marcas. */
const RAIL: Partial<Record<Estado, string>> = {
  critico: 'border-l-danger-mark',
  advertencia: 'border-l-warn-mark',
  'sin-reportar': 'border-l-warn-mark',
  atencion: 'border-l-attention-mark',
}

function Celda({ sensor, etiqueta, apagado }: { sensor: SensorResumen; etiqueta: string; apagado: boolean }) {
  return (
    <span className="flex min-w-0 flex-col items-end gap-px">
      <span className="truncate text-tag font-normal tracking-wide text-text-muted uppercase">
        {etiqueta}
      </span>
      <Lectura
        valor={sensor.ultimo_valor}
        unidad={sensor.unidad}
        tono={sensor.disparada ? 'critico' : 'normal'}
        apagado={apagado}
      />
    </span>
  )
}

export function FilaDispositivo({
  dispositivo,
  conectividad,
  ahora,
}: {
  dispositivo: DispositivoResumen
  conectividad: EstadoDispositivo
  ahora: number
}) {
  const { estado, etiqueta } = estadoDeFila(dispositivo, conectividad)
  const nombre = nombreDeDispositivo(dispositivo.id, dispositivo.nombre)
  const etiquetas = etiquetarSensores(dispositivo.sensores)
  const inactivo = !dispositivo.activo

  /* Por sensor y no por equipo: el estado de arriba habla del equipo, pero cada
     lectura tiene su propia antigüedad. */
  const desactualizada = (sensor: SensorResumen) =>
    inactivo || lecturaDesactualizada(sensor.ultimo_at, dispositivo.intervalo_efectivo_seg, ahora)

  return (
    <li>
      <Link
        to={`/dispositivos/${dispositivo.id}`}
        className={`group flex flex-col gap-2.5 border-l-2 py-3 pr-3.5 pl-3 transition-colors duration-130 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 ${
          RAIL[estado] ?? 'border-l-transparent'
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-body-lg font-semibold text-text group-hover:text-accent">
              {nombre}
            </span>
            {dispositivo.alertas_disparadas > 0 && (
              <PillConteo>{dispositivo.alertas_disparadas}</PillConteo>
            )}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-note-lg text-text-muted">
            <PastillaEstado estado={estado} etiqueta={etiqueta} capsula={false} latiendo />
            {dispositivo.ubicacion && (
              <>
                <span aria-hidden="true" className="text-border-strong">
                  ·
                </span>
                <span className="flex min-w-0 items-center gap-1">
                  <IconoUbicacion className="size-3.25 shrink-0" />
                  <span className="truncate">{dispositivo.ubicacion}</span>
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-border-strong">
              ·
            </span>
            <span>
              {dispositivo.last_seen_at ? <HaceCuanto iso={dispositivo.last_seen_at} /> : 'Nunca reportó'}
            </span>
          </span>
        </span>

        {dispositivo.sensores.length > 0 && (
          <span className="flex shrink-0 items-start gap-5 sm:justify-end">
            {dispositivo.sensores.map((s) => (
              <Celda
                key={s.id}
                sensor={s}
                etiqueta={etiquetas.get(s.id)!.etiqueta}
                apagado={desactualizada(s)}
              />
            ))}
          </span>
        )}

        <IconoChevron className="hidden size-4 shrink-0 text-text-muted group-hover:text-text sm:block" />
      </Link>
    </li>
  )
}
