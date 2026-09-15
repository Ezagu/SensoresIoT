import { Link } from 'react-router-dom'
import { Pill } from '@/components/ui/Pill'
import { useSesion } from '@/features/auth/sesion'
import { iniciales } from '@/components/layout/Layout'
import { IndiceAjustes, type Seccion } from './ajustes/IndiceAjustes'
import { SeccionApariencia } from './ajustes/SeccionApariencia'
import { SeccionNotificaciones } from './ajustes/SeccionNotificaciones'
import { SeccionPerfil } from './ajustes/SeccionPerfil'
import { SeccionSeguridad } from './ajustes/SeccionSeguridad'

/* Constante de módulo: su identidad es la llave del observador del índice. */
const SECCIONES: Seccion[] = [
  { id: 'perfil', etiqueta: 'Perfil' },
  { id: 'notificaciones', etiqueta: 'Notificaciones' },
  { id: 'apariencia', etiqueta: 'Apariencia' },
  { id: 'seguridad', etiqueta: 'Seguridad' },
]

export function Ajustes() {
  const { sesion, plan } = useSesion()
  const esPago = plan !== null && plan.plan.id !== 'free'

  return (
    <div className="flex max-w-180 flex-col gap-3 xl:max-w-232 xl:flex-row xl:gap-8">
      <IndiceAjustes secciones={SECCIONES} />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="mb-1 flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-group border border-border bg-surface-2 font-display text-page font-bold text-text"
          >
            {iniciales(sesion?.nombre)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-page-lg font-semibold text-text">
              {sesion?.nombre ?? 'Mi cuenta'}
            </h2>
            <p className="truncate text-label text-text-faint">{sesion?.email}</p>
          </div>
          {plan && (
            <Link
              to="/plan"
              className="ml-auto shrink-0 rounded-full transition-opacity duration-150 hover:opacity-80"
            >
              <Pill tono={esPago ? 'premium' : 'faint'}>Plan {plan.plan.nombre}</Pill>
            </Link>
          )}
        </header>

        <SeccionPerfil id="perfil" />
        <SeccionNotificaciones id="notificaciones" />
        <SeccionApariencia id="apariencia" />
        <SeccionSeguridad id="seguridad" />
      </div>
    </div>
  )
}
