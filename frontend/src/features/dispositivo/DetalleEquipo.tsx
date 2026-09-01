import { useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Vacio } from '@/components/ui/Vacio'

export function DetalleEquipo() {
  const { id } = useParams()
  return (
    <Card>
      <Vacio titulo="Detalle del equipo" detalle={`Lecturas, historial, alertas y export del equipo ${id}.`} />
    </Card>
  )
}
