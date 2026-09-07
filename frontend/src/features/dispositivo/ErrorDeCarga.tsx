import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Vacio } from '@/components/ui/Vacio'
import { estadoHttp } from '@/services/api'

export function Navegable({ titulo, detalle, volverA }: { titulo: string; detalle?: string; volverA: string }) {
  return (
    <Card>
      <Vacio
        titulo={titulo}
        detalle={detalle}
        accion={
          <Link to={volverA}>
            <Boton variante="sutil">Volver</Boton>
          </Link>
        }
      />
    </Card>
  )
}

const TEXTOS = {
  dispositivo: {
    noEncontrado: 'Este dispositivo no existe',
    detalleNoEncontrado: 'Puede que lo hayas desvinculado, o el link esté mal.',
    generico: 'No pudimos cargar este dispositivo',
  },
  sensor: {
    noEncontrado: 'Este sensor no existe',
    detalleNoEncontrado: undefined,
    generico: 'No pudimos cargar el sensor',
  },
}

/* Escalera 404 / 403 / error genérico de las dos pantallas de detalle, sólo
   mientras no hay datos que mostrar. */
export function ErrorDeCarga({
  error,
  errorCrudo,
  recurso,
  volverA,
  onReintentar,
}: {
  error: string
  errorCrudo: unknown
  recurso: keyof typeof TEXTOS
  volverA: string
  onReintentar: () => void
}) {
  const textos = TEXTOS[recurso]
  const status = estadoHttp(errorCrudo)

  if (status === 404) {
    return (
      <Navegable titulo={textos.noEncontrado} detalle={textos.detalleNoEncontrado} volverA={volverA} />
    )
  }
  if (status === 403) {
    return <Navegable titulo="No tenés acceso a este dispositivo" volverA={volverA} />
  }
  return (
    <Card>
      <Vacio
        titulo={textos.generico}
        detalle={error}
        accion={
          <Boton variante="sutil" onClick={onReintentar}>
            Reintentar
          </Boton>
        }
      />
    </Card>
  )
}
