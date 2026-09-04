import { useNavigate } from 'react-router-dom'
import { Segmentado } from '@/components/ui/Segmentado'
import { RANGOS, type RangoGrafico, type Ventana } from '@/lib/ventana'
import { permiteHistorialCompleto, rangoExcedeRetencion } from '@/lib/retencion'

type Opcion = RangoGrafico | 'maximo'

const OPCIONES: { valor: Opcion; etiqueta: string }[] = [...RANGOS, { valor: 'maximo', etiqueta: 'Máx' }]

export function SelectorVentana({
  ventana,
  onCambiar,
  retencionDias,
  primeraConexion,
}: {
  ventana: Ventana
  onCambiar: (v: Ventana) => void
  retencionDias: number | null
  primeraConexion: string | null
}) {
  const navigate = useNavigate()
  const permiteMaximo = permiteHistorialCompleto(retencionDias)
  const opcion: Opcion | null = ventana.tipo === 'preset' ? ventana.rango : ventana.tipo === 'maximo' ? 'maximo' : null

  function elegir(valor: Opcion) {
    if (valor === 'maximo') {
      // Sin primeraConexion (nunca reportó) cae a 24h: sale vacío igual.
      const desde = primeraConexion ? new Date(primeraConexion) : new Date(Date.now() - 24 * 3600_000)
      onCambiar({ tipo: 'maximo', desde })
      return
    }
    onCambiar({ tipo: 'preset', rango: valor })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Segmentado
        etiqueta="Rango del gráfico"
        valor={opcion}
        opciones={OPCIONES}
        onCambiar={elegir}
        bloqueada={(v) => (v === 'maximo' ? !permiteMaximo : rangoExcedeRetencion(v, retencionDias))}
        onBloqueada={() => navigate('/plan')}
      />
    </div>
  )
}
