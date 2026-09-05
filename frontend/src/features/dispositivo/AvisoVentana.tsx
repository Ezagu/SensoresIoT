import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Card } from '@/components/ui/Card'
import { limiteDeVentana } from '@/lib/retencion'
import { fecha } from '@/lib/tiempo'
import type { DatosGrafico } from '@/lib/tipos'

/* Una región vacía del gráfico significa cuatro cosas distintas —el equipo
   estuvo mudo, se instaló después, el plan no llega hasta ahí, o todavía
   carga— y ninguna se distingue de las otras mirando el trazo. Esto nombra las
   dos que la respuesta del backend ya permite afirmar. */
export function AvisoVentana({
  grafico,
  primeraConexion,
  desdePedidoMs,
}: {
  grafico: DatosGrafico | null
  primeraConexion: string | null
  desdePedidoMs: number
}) {
  const limite = limiteDeVentana(grafico, primeraConexion, desdePedidoMs)

  if (limite.corteDePlanMs !== null && grafico) {
    return (
      <Card tono="warn" className="flex flex-wrap items-center justify-between gap-3 p-3.5">
        <p className="text-label text-warn">
          Mostramos desde el {fecha(grafico.desde_efectivo)}
          {grafico.retencion_dias !== null && `: tu plan retiene los últimos ${grafico.retencion_dias} días`}.
        </p>
        <Link to="/plan">
          <Boton variante="sutil">Ver planes</Boton>
        </Link>
      </Card>
    )
  }

  if (limite.primeraConexion) {
    return (
      <p className="text-note-lg text-text-muted">
        Este equipo reportó por primera vez el {fecha(limite.primeraConexion)}. Antes de esa fecha no hay datos.
      </p>
    )
  }

  return null
}
