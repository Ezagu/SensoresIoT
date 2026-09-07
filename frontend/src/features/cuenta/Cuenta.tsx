import { Card } from '@/components/ui/Card'
import { Pendiente } from '@/components/ui/Pendiente'
import { useSesion } from '@/features/auth/sesion'

export function Cuenta() {
  const { sesion, plan } = useSesion()

  return (
    <div className="flex max-w-140 flex-col gap-3">
      <Card className="p-4">
        <h2 className="text-heading">{sesion?.nombre}</h2>
        <p className="mt-1 text-label text-text-faint">{sesion?.email}</p>
        {plan && (
          <p className="mt-3 text-label text-text-muted">
            Plan <strong className="font-medium text-text">{plan.plan.nombre}</strong>
          </p>
        )}
      </Card>

      <Pendiente titulo="Editar perfil" detalle="Cambiar nombre, mail y contraseña desde acá." />
    </div>
  )
}
