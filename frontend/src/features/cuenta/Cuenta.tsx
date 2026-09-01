import { Card } from '@/components/ui/Card'
import { Vacio } from '@/components/ui/Vacio'
import { useSesion } from '@/lib/auth'

export function Cuenta() {
  const { sesion, plan } = useSesion()

  return (
    <div className="flex max-w-140 flex-col gap-3">
      <Card className="p-4">
        <h2 className="text-[14px]">{sesion?.nombre}</h2>
        <p className="mt-1 text-[12px] text-text-faint">{sesion?.email}</p>
        {plan && (
          <p className="mt-3 text-[12px] text-text-muted">
            Plan <strong className="font-medium text-text">{plan.plan.nombre}</strong>
          </p>
        )}
      </Card>

      <Card>
        <Vacio titulo="Perfil" detalle="La edición de la cuenta se implementa más adelante." />
      </Card>
    </div>
  )
}
