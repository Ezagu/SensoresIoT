import { Banner } from '@/components/ui/Banner'
import { BotonLink } from '@/components/ui/Boton'
import { limiteDeVentana } from '@/utils/retencion'
import { fecha } from '@/utils/tiempo'
import type { DatosGrafico } from '@/tipos'

/* Una región vacía puede ser silencio del equipo, instalación posterior, corte
   del plan o carga en curso. Esto nombra las dos que el backend deja afirmar.
   El corte de plan va en tono informativo y no de advertencia: no se perdió
   nada, hay una puerta cerrada con la llave a la vista. */
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
      <Banner
        tono="info"
        titulo={
          grafico.retencion_dias !== null
            ? `Tu plan guarda todo, pero muestra ${grafico.retencion_dias} días`
            : 'Estás viendo una parte del rango pedido'
        }
        acciones={
          <BotonLink variante="sutil" to="/plan">
            Ver planes
          </BotonLink>
        }
      >
        Desde el <span className="num font-medium text-text">{fecha(grafico.desde_efectivo)}</span> en
        adelante. Lo anterior sigue guardado: al pasar a premium aparece completo, sin huecos.
      </Banner>
    )
  }

  if (limite.primeraConexion) {
    return (
      <p className="text-note-lg text-text-muted">
        Este equipo reportó por primera vez el{' '}
        <span className="num">{fecha(limite.primeraConexion)}</span>. Antes de esa fecha no hay datos.
      </p>
    )
  }

  return null
}
