import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { IconoAlertaSonando, IconoMas, IconoProblema, IconoReloj } from '@/components/layout/iconos'
import { useDispositivos } from './usarPanel'
import { useAhora } from '@/hooks/usarAhora'
import { estadoDispositivo, TIC_RELOJ_MS, type EstadoDispositivo } from '@/utils/tiempo'
import { TarjetaDispositivo } from './TarjetaDispositivo'
import type { DispositivoResumen } from '@/tipos'
import type { ReactNode } from 'react'
import { TextoError } from '@/components/ui/TextoError'

/* Los 3 indicadores del resumen. Nada de deltas porcentuales: un +5% sobre una
   temperatura no significa nada (el cero de la escala es arbitrario). */
function Kpi({
  icono,
  etiqueta,
  valor,
  tono,
}: {
  icono: ReactNode
  etiqueta: string
  valor: ReactNode
  tono?: 'ok' | 'warn' | 'danger'
}) {
  const color = tono ? { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger' }[tono] : ''
  return (
    <Card className="flex min-w-0 flex-col gap-1.5 p-3 md:flex-row md:items-center md:gap-3 md:p-3.5">
      <span className="flex size-6.5 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-muted">
        {icono}
      </span>
      <span className="min-w-0 truncate text-note text-text-muted md:flex-1 md:whitespace-normal">
        {etiqueta}
      </span>
      <span className={`num max-w-full truncate text-metric leading-tight font-semibold md:text-right ${color}`}>
        {valor}
      </span>
    </Card>
  )
}

function EsqueletoDispositivo() {
  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </Card>
  )
}

type Fila = { dispositivo: DispositivoResumen; estado: EstadoDispositivo }

function Grilla({ filas, ahora }: { filas: Fila[]; ahora: number }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filas.map(({ dispositivo, estado }) => (
        <li key={dispositivo.id} className="min-w-0">
          <TarjetaDispositivo dispositivo={dispositivo} estado={estado} ahora={ahora} />
        </li>
      ))}
    </ul>
  )
}

export function Panel() {
  const { datos: dispositivos, cargando, refrescando, error, refrescar, cadenciaSeg } = useDispositivos()

  // El tic del reloj nunca es más lento que el poll del panel: si el equipo
  // más rápido de la cartera reporta cada 15 s, el "hace X" también.
  const ahora = useAhora(
    cadenciaSeg !== undefined ? Math.min(TIC_RELOJ_MS, cadenciaSeg * 1000) : TIC_RELOJ_MS,
  )

  const resumen = useMemo(() => {
    const lista = dispositivos ?? []
    const filas: Fila[] = lista.map((d) => ({
      dispositivo: d,
      estado: estadoDispositivo(d.last_seen_at, d.intervalo_efectivo_seg, ahora),
    }))

    const ultimoReporte = lista.reduce<string | null>((max, d) => {
      const visto = d.last_seen_at
      if (!visto) return max
      return !max || Date.parse(visto) > Date.parse(max) ? visto : max
    }, null)

    return {
      /* El rol del vínculo es lo único que separa un dispositivo propio de uno
         que alguien compartió: 'owner' es dueño, editor y viewer son invitados. */
      propios: filas.filter((f) => f.dispositivo.rol === 'owner'),
      compartidos: filas.filter((f) => f.dispositivo.rol !== 'owner'),
      total: filas.length,
      alertas: lista.reduce((total, d) => total + d.alertas_disparadas, 0),
      // "Con problemas" es sólo conectividad: las alertas ya tienen su propio KPI
      conProblemas: filas.filter((f) => f.dispositivo.activo && f.estado === 'sin-reportar').length,
      ultimoReporte,
    }
  }, [dispositivos, ahora])

  return (
    <div className="flex flex-col gap-7">
      <section aria-label="Resumen">
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <Kpi
            icono={<IconoAlertaSonando className="size-3.5" />}
            etiqueta="Alertas disparadas"
            valor={cargando ? '—' : resumen.alertas}
            tono={resumen.alertas > 0 ? 'danger' : undefined}
          />
          <Kpi
            icono={<IconoProblema className="size-3.5" />}
            etiqueta="Dispositivos con problemas"
            valor={cargando ? '—' : resumen.conProblemas}
            tono={resumen.conProblemas > 0 ? 'warn' : undefined}
          />
          <Kpi
            icono={<IconoReloj className="size-3.5" />}
            etiqueta="Última actualización"
            valor={
              <span className="text-heading-lg">
                {cargando ? '—' : <HaceCuanto iso={resumen.ultimoReporte} />}
              </span>
            }
          />
        </div>
      </section>

      <section aria-label="Tus dispositivos">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="flex items-baseline gap-2 text-heading-lg">
            Tus dispositivos
            {refrescando && <span className="text-note font-normal text-text-faint">actualizando…</span>}
          </h2>
          <Link to="/vincular">
            <Boton>
              <IconoMas className="size-4" />
              Vincular dispositivo
            </Boton>
          </Link>
        </div>

        {/* Un fallo de poll con datos ya en pantalla es un aviso al costado, no
            un reemplazo: la última foto buena sigue siendo útil. */}
        {error && dispositivos && (
          <TextoError className="mb-3">
            No pudimos actualizar: {error}
          </TextoError>
        )}

        {cargando ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <EsqueletoDispositivo />
            <EsqueletoDispositivo />
          </div>
        ) : error && !dispositivos ? (
          <Card>
            <Vacio
              titulo="No pudimos cargar tus dispositivos"
              detalle={error}
              accion={
                <Boton variante="sutil" onClick={refrescar}>
                  Reintentar
                </Boton>
              }
            />
          </Card>
        ) : resumen.propios.length === 0 ? (
          <Card>
            <Vacio
              titulo={
                resumen.total === 0
                  ? 'Todavía no tenés dispositivos'
                  : 'Todavía no vinculaste uno propio'
              }
              detalle="Vinculá tu primer dispositivo con el código impreso en su base y empezá a ver sus lecturas acá."
              accion={
                <Link to="/vincular">
                  <Boton>
                    <IconoMas className="size-4" />
                    Vincular dispositivo
                  </Boton>
                </Link>
              }
            />
          </Card>
        ) : (
          <Grilla filas={resumen.propios} ahora={ahora} />
        )}
      </section>

      {/* Sin compartidos no se anuncia la sección: hoy nada en la app crea
          vínculos que no sean 'owner', así que para la mayoría no existe. */}
      {resumen.compartidos.length > 0 && (
        <section aria-label="Dispositivos compartidos">
          <div className="mb-3 flex flex-col gap-0.5">
            <h2 className="text-heading-lg">Dispositivos compartidos</h2>
            <p className="text-note text-text-faint">
              De otras cuentas, con acceso de lectura o edición.
            </p>
          </div>
          <Grilla filas={resumen.compartidos} ahora={ahora} />
        </section>
      )}
    </div>
  )
}
