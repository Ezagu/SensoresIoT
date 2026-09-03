import { Boton } from '@/components/ui/Boton'
import { IconoActualizar } from '@/components/layout/iconos'
import type { Ventana } from '@/lib/ventana'
import { SelectorVentana } from './SelectorVentana'

/* `titulo` envuelve con el encabezado "Lecturas", que sólo usa la pantalla
   de dispositivo; sin él es sólo la fila de controles. */
export function BarraVentana({
  titulo,
  ventana,
  onCambiar,
  retencionDias,
  enVivo,
  refrescar,
  refrescando,
  etiquetaActualizar,
  varianteActualizar = 'fantasma',
  hayZoom,
  onRestablecer,
}: {
  titulo?: string
  ventana: Ventana
  onCambiar: (v: Ventana) => void
  retencionDias: number | null
  enVivo: boolean
  refrescar: () => void
  refrescando: boolean
  etiquetaActualizar?: string
  varianteActualizar?: 'fantasma' | 'sutil'
  hayZoom: boolean
  onRestablecer: () => void
}) {
  const controles = (
    <div className="flex flex-wrap items-end gap-2">
      <SelectorVentana ventana={ventana} onCambiar={onCambiar} retencionDias={retencionDias} />
      {!enVivo && (
        <Boton variante={varianteActualizar} onClick={refrescar} disabled={refrescando}>
          <IconoActualizar className="size-3.5" />
          {etiquetaActualizar}
        </Boton>
      )}
      {hayZoom && (
        <Boton variante="sutil" onClick={onRestablecer}>
          Restablecer zoom
        </Boton>
      )}
    </div>
  )

  if (!titulo) return controles

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h3 className="text-body font-medium text-text-muted">{titulo}</h3>
      {controles}
    </div>
  )
}
