import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Vacio } from '@/components/ui/Vacio'
import { estadoHttp } from '@/lib/api'

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

/* Escalera 404 / 403 / error genérico compartida por las dos pantallas de
   detalle, sólo mientras no hay datos que mostrar. */
export function ErrorDeCarga({
  error,
  errorCrudo,
  esNoEncontrado,
  volverA,
  tituloNoEncontrado,
  detalleNoEncontrado,
  tituloSinAcceso,
  tituloGenerico,
  onReintentar,
}: {
  error: string
  errorCrudo: unknown
  /* Fuerza el caso 404 aunque errorCrudo no traiga un status http (p. ej. un
     sensorId ajeno al dispositivo, resuelto sin red — SensorNoEncontradoError). */
  esNoEncontrado?: boolean
  volverA: string
  tituloNoEncontrado: string
  detalleNoEncontrado?: string
  tituloSinAcceso: string
  tituloGenerico: string
  onReintentar: () => void
}) {
  const status = esNoEncontrado ? 404 : estadoHttp(errorCrudo)

  if (status === 404) {
    return <Navegable titulo={tituloNoEncontrado} detalle={detalleNoEncontrado} volverA={volverA} />
  }
  if (status === 403) {
    return <Navegable titulo={tituloSinAcceso} volverA={volverA} />
  }
  return (
    <Card>
      <Vacio
        titulo={tituloGenerico}
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
