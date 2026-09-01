import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { IconoAlerta, IconoMas, IconoProblema, IconoReloj } from '@/components/layout/iconos'
import { intervaloEfectivo, useEquipos } from '@/lib/equipos'
import { useAhora } from '@/lib/usarCarga'
import { estadoDispositivo, haceCuanto } from '@/lib/tiempo'
import { useSesion } from '@/lib/auth'
import { TarjetaEquipo } from './TarjetaEquipo'
import type { ReactNode } from 'react'

/* Los datos se piden una vez al montar; lo único que se refresca solo es lo que
   se deriva de la hora (estado de conexión y "hace X"), que si no envejece
   mintiendo con la pestaña abierta. */
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
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-surface-2 text-text-muted">
        {icono}
      </span>
      <span className="min-w-0 truncate text-[11px] text-text-muted md:flex-1 md:whitespace-normal">
        {etiqueta}
      </span>
      <span className={`num max-w-full truncate text-[21px] leading-tight font-semibold md:text-right ${color}`}>
        {valor}
      </span>
    </Card>
  )
}

function EsqueletoEquipo() {
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

export function Panel() {
  const { plan } = useSesion()
  const { datos: equipos, cargando, error, reintentar } = useEquipos()
  const ahora = useAhora(TIC_MS)
  const pisoPlan = plan?.plan.intervalo_minimo_seg

  const resumen = useMemo(() => {
    const lista = equipos ?? []
    const estados = lista.map((e) => ({
      equipo: e,
      estado: estadoDispositivo(
        e.dispositivo.last_seen_at,
        intervaloEfectivo(e.dispositivo, pisoPlan),
        ahora,
      ),
    }))

    const ultimoReporte = lista.reduce<string | null>((max, e) => {
      const visto = e.dispositivo.last_seen_at
      if (!visto) return max
      return !max || Date.parse(visto) > Date.parse(max) ? visto : max
    }, null)

    return {
      estados,
      alertas: lista.reduce((total, e) => total + e.alertasDisparadas, 0),
      // "Con problemas" es sólo conectividad: las alertas ya tienen su propio KPI
      conProblemas: estados.filter(
        (e) => e.equipo.dispositivo.activo && e.estado === 'sin-reportar',
      ).length,
      ultimoReporte,
    }
  }, [equipos, ahora, pisoPlan])

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
              <span className="text-[15px]">
                {cargando ? '—' : haceCuanto(resumen.ultimoReporte)}
              </span>
            }
          />
        </div>
      </section>

      <section aria-label="Equipos">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px]">Tus equipos</h2>
          <Link to="/vincular">
            <Boton>
              <IconoMas className="size-4" />
              Vincular equipo
            </Boton>
          </Link>
        </div>

        {cargando ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <EsqueletoEquipo />
            <EsqueletoEquipo />
          </div>
        ) : error ? (
          <Card>
            <Vacio
              titulo="No pudimos cargar tus equipos"
              detalle={error}
              accion={
                <Boton variante="sutil" onClick={reintentar}>
                  Reintentar
                </Boton>
              }
            />
          </Card>
        ) : resumen.estados.length === 0 ? (
          <Card>
            <Vacio
              titulo="Todavía no tenés equipos"
              detalle="Vinculá tu primer equipo con el código impreso en su base y empezá a ver sus lecturas acá."
              accion={
                <Link to="/vincular">
                  <Boton>
                    <IconoMas className="size-4" />
                    Vincular equipo
                  </Boton>
                </Link>
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resumen.estados.map(({ equipo, estado }) => (
              <li key={equipo.dispositivo.id} className="min-w-0">
                <TarjetaEquipo equipo={equipo} estado={estado} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
