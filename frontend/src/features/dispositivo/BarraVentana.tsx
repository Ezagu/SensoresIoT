import { Boton } from '@/components/ui/Boton'
import { IconoActualizar } from '@/components/layout/iconos'
import type { Ventana } from '@/lib/ventana'
import { SelectorVentana } from './SelectorVentana'

export function BarraVentana({
  ventana,
  onCambiar,
  retencionDias,
  primeraConexion,
  enVivo,
  refrescar,
  refrescando,
  hayZoom,
  onRestablecer,
}: {
  ventana: Ventana
  retencionDias: number | null
  primeraConexion: string | null
  refrescando: boolean
  enVivo: boolean
  hayZoom: boolean
  refrescar: () => void
  onCambiar: (v: Ventana) => void
  onRestablecer: () => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <SelectorVentana
        ventana={ventana}
        onCambiar={onCambiar}
        retencionDias={retencionDias}
        primeraConexion={primeraConexion}
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
    </div>
  )
}
