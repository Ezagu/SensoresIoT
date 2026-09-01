import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Vacio } from '@/components/ui/Vacio'
import { IconoAlerta, IconoMas, IconoProblema, IconoReloj } from '@/components/layout/iconos'
import type { ReactNode } from 'react'

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

export function Panel() {
  return (
    <div className="flex flex-col gap-7">
      <section aria-label="Resumen">
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <Kpi icono={<IconoAlerta className="size-3.5" />} etiqueta="Alertas activas" valor="—" tono="danger" />
          <Kpi
            icono={<IconoProblema className="size-3.5" />}
            etiqueta="Dispositivos con problemas"
            valor="—"
            tono="warn"
          />
          <Kpi
            icono={<IconoReloj className="size-3.5" />}
            etiqueta="Última actualización"
            valor={<span className="text-[15px]">—</span>}
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
        <Card>
          <Vacio
            titulo="Todavía no hay datos"
            detalle="El panel se cablea contra la API en el siguiente paso."
          />
        </Card>
      </section>
    </div>
  )
}
