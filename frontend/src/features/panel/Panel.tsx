import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { IconoAlerta, IconoMas, IconoProblema, IconoReloj } from '@/components/layout/iconos'
import { intervaloEfectivo, useDispositivos, type DispositivoPanel } from '@/lib/dispositivos'
import { useAhora } from '@/lib/usarCarga'
import { estadoDispositivo, haceCuanto, type EstadoDispositivo } from '@/lib/tiempo'
import { useSesion } from '@/lib/auth'
import { TarjetaDispositivo } from './TarjetaDispositivo'
import type { ReactNode } from 'react'

/* Los datos hacen poll solos (ver POLL_PANEL_MS en lib/dispositivos.ts); este tic es
   más fino, sólo para lo que se deriva de la hora (estado de conexión y
   "hace X"), que si no envejece mintiendo entre un poll y el siguiente. */
const TIC_MS = 30_000

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

type Fila = { datos: DispositivoPanel; estado: EstadoDispositivo; intervaloSeg: number }

function Grilla({ filas, ahora }: { filas: Fila[]; ahora: number }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filas.map(({ datos, estado, intervaloSeg }) => (
        <li key={datos.dispositivo.id} className="min-w-0">
          <TarjetaDispositivo
            datos={datos}
            estado={estado}
            intervaloSeg={intervaloSeg}
            ahora={ahora}
          />
        </li>
      ))}
    </ul>
  )
}

export function Panel() {
  const { plan } = useSesion()
  const { datos: dispositivos, cargando, refrescando, error, refrescar } = useDispositivos()
  const ahora = useAhora(TIC_MS)
  const pisoPlan = plan?.plan.intervalo_minimo_seg

  const resumen = useMemo(() => {
    const lista = dispositivos ?? []
    const estados = lista.map((e) => {
      const intervaloSeg = intervaloEfectivo(e.dispositivo, pisoPlan)
      return {
        datos: e,
        intervaloSeg,
        estado: estadoDispositivo(e.dispositivo.last_seen_at, intervaloSeg, ahora),
      }
    })

    const ultimoReporte = lista.reduce<string | null>((max, e) => {
      const visto = e.dispositivo.last_seen_at
      if (!visto) return max
      return !max || Date.parse(visto) > Date.parse(max) ? visto : max
    }, null)

    return {
      /* El rol del vínculo es lo único que separa un dispositivo propio de uno
         que alguien compartió: 'owner' es dueño, editor y viewer son invitados. */
      propios: estados.filter((e) => e.datos.dispositivo.rol === 'owner'),
      compartidos: estados.filter((e) => e.datos.dispositivo.rol !== 'owner'),
      total: estados.length,
      alertas: lista.reduce((total, e) => total + e.alertasDisparadas, 0),
      // "Con problemas" es sólo conectividad: las alertas ya tienen su propio KPI
      conProblemas: estados.filter(
        (e) => e.datos.dispositivo.activo && e.estado === 'sin-reportar',
      ).length,
      ultimoReporte,
    }
  }, [dispositivos, ahora, pisoPlan])

  return (
    <div className="flex flex-col gap-7">
      <section aria-label="Resumen">
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <Kpi
            icono={<IconoAlerta className="size-3.5" />}
            etiqueta="Alertas activas"
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
                {cargando ? '—' : haceCuanto(resumen.ultimoReporte)}
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
          <p role="alert" className="mb-3 text-label text-danger">
            No pudimos actualizar: {error}
          </p>
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
