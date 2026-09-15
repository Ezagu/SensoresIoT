import { Boton } from '@/components/ui/Boton'
import { Segmentado } from '@/components/ui/Segmentado'
import { IconoActualizar } from '@/components/layout/iconos'
import { RANGOS, type RangoGrafico, type Ventana } from '@/utils/ventana'
import { permiteHistorialCompleto, rangoExcedeRetencion } from '@/utils/retencion'

type Opcion = RangoGrafico | 'maximo'

const OPCIONES: { valor: Opcion; etiqueta: string }[] = [...RANGOS, { valor: 'maximo', etiqueta: 'Máx' }]

export function BarraVentana({
  ventana,
  onCambiar,
  retencionDias,
  primeraConexion,
  enVivo,
  refrescar,
  refrescando,
  desactualizado,
  hayZoom,
  onRestablecer,
}: {
  ventana: Ventana
  retencionDias: number | null
  primeraConexion: string | null
  refrescando: boolean
  /* Lo dibujado todavía es del rango anterior. */
  desactualizado: boolean
  enVivo: boolean
  hayZoom: boolean
  refrescar: () => void
  onCambiar: (v: Ventana) => void
  onRestablecer: () => void
}) {
  const opcion: Opcion | null =
    ventana.tipo === 'preset' ? ventana.rango : ventana.tipo === 'maximo' ? 'maximo' : null

  function elegir(valor: Opcion) {
    if (valor === 'maximo') {
      // Sin primeraConexion (nunca reportó) cae a 24h: sale vacío igual.
      const desde = primeraConexion ? new Date(primeraConexion) : new Date(Date.now() - 24 * 3600_000)
      onCambiar({ tipo: 'maximo', desde })
      return
    }
    onCambiar({ tipo: 'preset', rango: valor })
  }

  /* En vivo el poll refresca solo y anunciarlo sería parpadeo; lo que sí hay que
     decir es que el rango recién elegido todavía no llegó. */
  const avisando = desactualizado || (refrescando && !enVivo)

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Segmentado
        etiqueta="Rango del gráfico"
        valor={opcion}
        opciones={OPCIONES}
        onCambiar={elegir}
        columnasAngosto={OPCIONES.length - 1}
        fueraDelPlan={(v) =>
          v === 'maximo' ? !permiteHistorialCompleto(retencionDias) : rangoExcedeRetencion(v, retencionDias)
        }
        numerico
      />
      {!enVivo && (
        <Boton variante="fantasma" onClick={refrescar} disabled={refrescando}>
          <IconoActualizar className="size-3.5" />
          Actualizar
        </Boton>
      )}
      {hayZoom && (
        <Boton variante="fantasma" onClick={onRestablecer}>
          Restablecer zoom
        </Boton>
      )}
      {/* Montado siempre, aunque esté vacío: una región viva que aparece junto
          con su texto no llega a anunciarse. */}
      <span role="status" className="self-center text-note text-text-muted">
        {avisando ? 'actualizando…' : ''}
      </span>
    </div>
  )
}
