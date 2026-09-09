import { Link } from 'react-router-dom'
import { Pill, TONO_POR_ESTADO } from '@/components/ui/Pill'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import {
  IconoAjustes,
  IconoAlertaSonando,
  IconoChevron,
  IconoCompartido,
  IconoUbicacion,
} from '@/components/layout/iconos'
import { intervalo as formatoIntervalo } from '@/utils/formato'
import { ETIQUETA_ESTADO, type EstadoDispositivo } from '@/utils/tiempo'
import { ETIQUETA_ROL, nombreDeDispositivo, puedeEditar } from '@/utils/dispositivos'
import { etiquetarSensores } from '@/utils/sensores'
import type { DispositivoInventario } from '@/tipos'

/* La tira es la huella del equipo: mismo hue fijo por tipo que en toda la app
   (utils/sensores.ts). Se reconoce el sensor sin leer, no hace falta más. */
function TiraSensores({
  sensores,
  apagada,
}: {
  sensores: DispositivoInventario['sensores']
  apagada: boolean
}) {
  if (sensores.length === 0) {
    return <span className="text-note text-text-faint">Sin sensores</span>
  }
  const etiquetas = etiquetarSensores(sensores)
  return (
    <ul className="flex items-center gap-1">
      {sensores.map((s) => {
        const meta = etiquetas.get(s.id)!
        return (
          <li key={s.id}>
            <span
              role="img"
              aria-label={meta.etiqueta}
              title={meta.etiqueta}
              className="block size-2.5 rounded-full"
              style={{ background: apagada ? 'var(--color-text-faint)' : meta.color }}
            />
          </li>
        )
      })}
    </ul>
  )
}

export function FilaEquipo({
  dispositivo,
  estado,
}: {
  dispositivo: DispositivoInventario
  estado: EstadoDispositivo
}) {
  const inactivo = !dispositivo.activo
  const nombre = nombreDeDispositivo(dispositivo.id, dispositivo.nombre)

  return (
    <li className="flex flex-col gap-2.5 p-3.5 md:flex-row md:items-center md:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/dispositivos/${dispositivo.id}`}
            className={`truncate font-display text-heading font-semibold hover:text-accent ${
              inactivo ? 'text-text-muted' : 'text-text'
            }`}
          >
            {nombre}
          </Link>
          {dispositivo.alertas_disparadas > 0 && (
            <IconoAlertaSonando
              className="size-3.25 shrink-0 text-danger"
              aria-label={
                dispositivo.alertas_disparadas === 1 ? '1 alerta disparada' : `${dispositivo.alertas_disparadas} alertas disparadas`
              }
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-note text-text-faint">
          {dispositivo.ubicacion && (
            <span className="flex min-w-0 items-center gap-1">
              <IconoUbicacion className="size-3.25 shrink-0" />
              <span className="truncate">{dispositivo.ubicacion}</span>
            </span>
          )}
          {dispositivo.rol !== 'owner' && (
            <span className="flex items-center gap-1">
              <IconoCompartido className="size-3.25 shrink-0" />
              {dispositivo.owner_nombre ?? '—'} · {ETIQUETA_ROL[dispositivo.rol]}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 md:justify-end">
        <TiraSensores sensores={dispositivo.sensores} apagada={inactivo} />

        {dispositivo.alertas_total > 0 && (
          <span className="text-note text-text-faint">
            {dispositivo.alertas_total === 1 ? '1 alerta' : `${dispositivo.alertas_total} alertas`}
          </span>
        )}

        <span className="num text-note whitespace-nowrap text-text-faint">
          cada {formatoIntervalo(dispositivo.intervalo_efectivo_seg)}
        </span>

        {inactivo ? (
          <Pill tono="faint">Desactivado</Pill>
        ) : (
          <Pill tono={TONO_POR_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Pill>
        )}

        <span className="whitespace-nowrap text-note text-text-faint">
          {dispositivo.last_seen_at ? (
            <>
              hace <HaceCuanto iso={dispositivo.last_seen_at} />
            </>
          ) : dispositivo.first_connected_at ? (
            'Nunca reportó'
          ) : (
            'Todavía no se conectó'
          )}
        </span>

        <div className="flex items-center gap-0.5">
          {puedeEditar(dispositivo.rol) && (
            <Link
              to={`/dispositivos/${dispositivo.id}/ajustes`}
              aria-label={`Ajustes de ${nombre}`}
              className="flex items-center gap-1 rounded-control px-2 py-1.5 text-note font-medium text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <IconoAjustes className="size-3.5" />
              <span className="md:hidden">Ajustes</span>
            </Link>
          )}
          <Link
            to={`/dispositivos/${dispositivo.id}`}
            aria-label={`Ver detalle de ${nombre}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <IconoChevron className="size-3.75" />
          </Link>
        </div>
      </div>
    </li>
  )
}
