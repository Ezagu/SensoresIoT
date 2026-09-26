import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { Boton } from '@/components/ui/Boton'
import { IndiceAjustes, type Seccion } from '@/components/ui/IndiceAjustes'
import { ZonaPeligro } from '@/components/ui/SeccionAjustes'
import { SeccionApariencia } from './ajustes/SeccionApariencia'
import { SeccionNotificaciones } from './ajustes/SeccionNotificaciones'
import { SeccionPerfil } from './ajustes/SeccionPerfil'
import { SeccionPlan } from './ajustes/SeccionPlan'
import { SeccionSeguridad } from './ajustes/SeccionSeguridad'

/* Constantes de módulo: su identidad es la llave del observador del índice. */
const SECCIONES: Seccion[] = [
  { id: 'perfil', etiqueta: 'Perfil' },
  { id: 'avisos', etiqueta: 'Avisos' },
  { id: 'plan', etiqueta: 'Plan' },
  { id: 'seguridad', etiqueta: 'Seguridad' },
  { id: 'preferencias', etiqueta: 'Preferencias' },
]
const ELIMINAR: Seccion = { id: 'eliminar', etiqueta: 'Eliminar cuenta' }

export function Ajustes() {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:gap-14">
      <div className="xl:pt-17">
        <IndiceAjustes secciones={SECCIONES} peligro={ELIMINAR} />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="pb-9 text-page">Tu cuenta</h1>
        <SeccionPerfil id="perfil" />
        <SeccionNotificaciones id="avisos" />
        <SeccionPlan id="plan" />
        <SeccionSeguridad id="seguridad" />
        <SeccionApariencia id="preferencias" />

        {/* PENDIENTE (backend + definición legal del borrado de datos, ver CLAUDE.md). */}
        <ZonaPeligro
          id={ELIMINAR.id}
          titulo="Eliminar cuenta"
          accion={
            <Boton variante="peligro" disabled title="Pendiente de backend">
              Eliminar cuenta
            </Boton>
          }
        >
          <p>
            Perdés el acceso a tus equipos y a su historial. Las personas con quienes compartiste
            equipos también dejan de verlos.
          </p>
          <div className="mt-3">
            <AvisoPendiente>
              no hay endpoint para eliminar la cuenta, y falta definir qué se borra (pendiente
              legal).
            </AvisoPendiente>
          </div>
        </ZonaPeligro>
      </div>
    </div>
  )
}
