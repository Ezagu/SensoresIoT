import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { excedeRetencion } from '@/lib/retencion'

export function AvisoRetencion({ desde, retencionDias }: { desde: Date; retencionDias: number | null }) {
  if (!excedeRetencion(desde, retencionDias)) return null

  return (
    <Card tono="warn" className="flex flex-wrap items-center justify-between gap-3 p-3.5">
      <p className="text-label text-warn">
        Tu plan sólo muestra los últimos {retencionDias} días. El rango pedido se acortó.
      </p>
      <Link to="/plan">
        <Boton variante="sutil">Ver planes</Boton>
      </Link>
    </Card>
  )
}
