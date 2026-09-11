import { BotonCopiar } from '@/components/ui/BotonCopiar'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { ETIQUETA_ROL } from '@/utils/dispositivos'
import { fechaHora } from '@/utils/tiempo'
import { intervalo as formatoIntervalo } from '@/utils/formato'
import type { DispositivoDetalle } from '@/tipos'
import type { SensorConMeta } from '../usarDispositivo'
import { SeccionAjustes } from './SeccionAjustes'

/* Solo lectura: el ID no aparece en ninguna otra pantalla y es lo primero que
   se pide por teléfono en un soporte. */
export function FichaEquipo({
  dispositivo,
  sensores,
}: {
  dispositivo: DispositivoDetalle
  sensores: SensorConMeta[]
}) {
  const intervaloSeg = dispositivo.intervalo_efectivo_seg

  return (
    <SeccionAjustes titulo="Ficha del equipo">
      <dl className="grid gap-x-6 gap-y-3 text-label sm:grid-cols-2">
        {/* min-w-0 en los dos niveles: el UUID va en una sola línea, así que sin
            esto su ancho mínimo estira la columna de la grilla y con ella la
            página, y el truncate nunca llega a aplicarse. */}
        <div className="min-w-0">
          <dt className="text-text-faint">ID del equipo</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <span className="num truncate text-text">{dispositivo.id}</span>
            <BotonCopiar texto={dispositivo.id} etiqueta="Copiar ID del equipo" variante="icono" />
          </dd>
        </div>
        <div>
          <dt className="text-text-faint">Estado</dt>
          <dd className="text-text">{dispositivo.activo ? 'Activo' : 'Pausado'}</dd>
        </div>
        <div>
          <dt className="text-text-faint">Primera conexión</dt>
          <dd className="text-text">
            {dispositivo.first_connected_at ? fechaHora(dispositivo.first_connected_at) : 'Todavía no se conectó'}
          </dd>
        </div>
        <div>
          <dt className="text-text-faint">Último reporte</dt>
          <dd className="text-text">
            {dispositivo.last_seen_at ? (
              <>
                <HaceCuanto iso={dispositivo.last_seen_at} /> · {fechaHora(dispositivo.last_seen_at)}
              </>
            ) : (
              'Nunca reportó'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-text-faint">Intervalo efectivo</dt>
          <dd className="text-text">
            {formatoIntervalo(intervaloSeg)}
          </dd>
        </div>
        <div>
          <dt className="text-text-faint">Dueño</dt>
          <dd className="text-text">
            {dispositivo.owner_nombre ?? '—'} · vos sos {ETIQUETA_ROL[dispositivo.rol]}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-text-faint">Sensores instalados</dt>
          <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
            {sensores.length === 0 ? (
              <span className="text-text">Sin sensores</span>
            ) : (
              sensores.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-text">
                  <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: s.color }} />
                  {s.etiqueta}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>
    </SeccionAjustes>
  )
}
