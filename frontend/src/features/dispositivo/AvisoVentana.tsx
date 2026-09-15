import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Card } from '@/components/ui/Card'
import { limiteDeVentana } from '@/utils/retencion'
import { fecha } from '@/utils/tiempo'
import type { DatosGrafico } from '@/tipos'

/* Una región vacía puede ser silencio del equipo, instalación posterior, corte
   del plan o carga en curso. Esto nombra las dos que el backend deja afirmar. */
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
          Mostramos desde el <span className="num">{fecha(grafico.desde_efectivo)}</span>
          {grafico.retencion_dias !== null && (
            <>
              : tu plan retiene los últimos <span className="num">{grafico.retencion_dias}</span> días
            </>
          )}
          .
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
        Este equipo reportó por primera vez el <span className="num">{fecha(limite.primeraConexion)}</span>. Antes
        de esa fecha no hay datos.
      </p>
    )
  }

  return null
}
