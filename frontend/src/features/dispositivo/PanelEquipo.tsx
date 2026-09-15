import { Link } from 'react-router-dom'
import { Bloque } from '@/components/ui/Bloque'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { IconoChevron } from '@/components/layout/iconos'
import { ETIQUETA_ROL } from '@/utils/dispositivos'
import { fecha } from '@/utils/tiempo'
import type { DispositivoDetalle } from '@/tipos'

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-label text-text-muted">{termino}</dt>
      <dd className="m-0 min-w-0 text-label-lg text-text">{children}</dd>
    </>
  )
}

/* Lo que no cambia con el rango elegido ni con la última lectura: de quién es
   el equipo, desde cuándo reporta y hasta dónde llega su historial. */
export function PanelEquipo({
  dispositivo,
  lastSeenAt,
  retencionDias,
}: {
  dispositivo: DispositivoDetalle
  lastSeenAt: string | null
  /* Del plan del DUEÑO, y sólo la sabe la respuesta de /grafico: null mientras
     no llegó, y también cuando el plan no recorta nada. */
  retencionDias: number | null
}) {
  return (
    <Bloque titulo="Equipo">
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2.5">
        <Dato termino="Última lectura">
          {lastSeenAt ? (
            <span className="num">
              <HaceCuanto iso={lastSeenAt} />
            </span>
          ) : (
            'Nunca reportó'
          )}
        </Dato>

        <Dato termino="Primera conexión">
          {dispositivo.first_connected_at ? (
            <span className="num">{fecha(dispositivo.first_connected_at)}</span>
          ) : (
            '—'
          )}
        </Dato>

        <Dato termino="Historial">
          {retencionDias === null ? (
            'Completo'
          ) : (
            <>
              Últimos <span className="num">{retencionDias}</span> días
            </>
          )}
        </Dato>

        <Dato termino="Dueño">
          <span className="truncate">{dispositivo.owner_nombre ?? '—'}</span>
        </Dato>

        <Dato termino="Tu rol">{ETIQUETA_ROL[dispositivo.rol]}</Dato>
      </dl>

      <Link
        to={`/dispositivos/${dispositivo.id}/ajustes`}
        className="-mx-2 mt-4 flex items-center gap-1.5 rounded-control px-2 py-1.5 text-label-lg font-medium text-text-muted transition-colors duration-130 hover:bg-surface-2 hover:text-text"
      >
        Ajustes del equipo
        <IconoChevron className="size-3.5" />
      </Link>
    </Bloque>
  )
}
