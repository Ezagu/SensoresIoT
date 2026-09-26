import { BotonLink } from '@/components/ui/Boton'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { Skeleton } from '@/components/ui/Skeleton'
import { useSesion } from '@/features/auth/sesion'

/* Qué incluye el plan de la cuenta, dicho en cifras. Es el de la cuenta: lo de
   cada equipo sale del plan de su dueño y se ve en el equipo. */
export function SeccionPlan({ id }: { id: string }) {
  const { plan } = useSesion()

  if (!plan) {
    return (
      <SeccionAjustes id={id} titulo="Plan">
        <Skeleton className="h-32 w-full" />
      </SeccionAjustes>
    )
  }

  const p = plan.plan
  const free = p.id === 'free'

  return (
    <SeccionAjustes id={id} titulo="Plan">
      <div className="flex flex-col gap-5 rounded-card border border-border-control px-6 py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-metric font-semibold">{p.nombre}</p>
          <ul className="mt-2.5 flex flex-col gap-1 text-body text-text-muted">
            <li>
              {p.retencion_dias === null ? (
                <b className="font-medium text-text">Historial completo.</b>
              ) : (
                <>
                  <b className="font-medium text-text">{p.retencion_dias} días</b> visibles de
                  historial. Se guarda todo.
                </>
              )}
            </li>
            <li>
              {!p.puede_alertas ? (
                'Sin reglas de alerta.'
              ) : p.max_alertas === null ? (
                <>
                  <b className="font-medium text-text">Reglas sin tope</b> por equipo.
                </>
              ) : (
                <>
                  <b className="font-medium text-text">
                    {p.max_alertas} {p.max_alertas === 1 ? 'regla' : 'reglas'}
                  </b>{' '}
                  de alerta por equipo.
                </>
              )}
            </li>
            <li>Export CSV y aviso de «dejó de reportar» incluidos.</li>
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end md:text-right">
          <BotonLink to="/plan" variante={free ? 'primario' : 'sutil'}>
            {free ? 'Pasar a Premium' : 'Ver plan'}
          </BotonLink>
          {free && (
            <p className="text-note text-text-muted">Historial completo y reglas sin tope.</p>
          )}
        </div>
      </div>
    </SeccionAjustes>
  )
}
