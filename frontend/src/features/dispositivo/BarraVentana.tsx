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
  /* En vivo el poll refresca solo cada pocos segundos y anunciarlo sería puro
     parpadeo; lo que sí hay que decir es que el rango recién elegido todavía no
     llegó, y que un "Actualizar" a mano está en curso. */
  const avisando = desactualizado || (refrescando && !enVivo)

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
      {/* Montado siempre, aunque esté vacío: una región viva que aparece junto
          con su texto no llega a anunciarse. */}
      <span role="status" className="self-center text-note text-text-muted">
        {avisando ? 'actualizando…' : ''}
      </span>
    </div>
  )
}
