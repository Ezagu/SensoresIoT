import { useState } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Segmentado } from '@/components/ui/Segmentado'
import { IconoActualizar } from '@/components/layout/iconos'
import { RANGOS, resolverVentana, type RangoGrafico, type Ventana } from '@/utils/ventana'
import { rangoExcedeRetencion } from '@/utils/retencion'

type Opcion = RangoGrafico | 'personalizado'

/* datetime-local no lleva zona: se escribe y se lee en hora local. */
function aCampo(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function CampoFecha({
  etiqueta,
  valor,
  onCambiar,
}: {
  etiqueta: string
  valor: Date
  onCambiar: (d: Date) => void
}) {
  return (
    <label className="flex flex-col gap-0.75">
      <span className="text-tag text-text-faint">{etiqueta}</span>
      <input
        type="datetime-local"
        value={aCampo(valor)}
        max={aCampo(new Date())}
        onChange={(e) => e.target.value && onCambiar(new Date(e.target.value))}
        className="num h-9 w-42 rounded-control border border-border-control bg-transparent px-2.5 text-body font-normal text-text focus:border-accent-border focus:outline-none"
      />
    </label>
  )
}

export function BarraVentana({
  ventana,
  onCambiar,
  retencionDias,
  compacta = false,
  enVivo,
  refrescar,
  refrescando,
  desactualizado,
  hayZoom,
  onRestablecer,
}: {
  ventana: Ventana
  retencionDias: number | null
  /* Sin "Personalizado": el detalle del equipo sólo mira hacia atrás desde ahora. */
  compacta?: boolean
  refrescando: boolean
  /* Lo dibujado todavía es del rango anterior. */
  desactualizado: boolean
  enVivo: boolean
  hayZoom: boolean
  refrescar: () => void
  onCambiar: (v: Ventana) => void
  onRestablecer: () => void
}) {
  /* "Personalizado" se abre antes de tocar una fecha: hasta entonces sigue el
     rango que había, con sus fechas como punto de partida. */
  const [abierto, setAbierto] = useState(ventana.tipo === 'fechas')
  const personalizado = abierto || ventana.tipo === 'fechas'
  const opcion: Opcion = personalizado
    ? 'personalizado'
    : ventana.tipo === 'preset'
      ? ventana.rango
      : '24h'
  const { desde, hasta } = resolverVentana(ventana)

  const opciones: { valor: Opcion; etiqueta: string }[] = compacta
    ? RANGOS
    : [...RANGOS, { valor: 'personalizado', etiqueta: 'Personalizado' }]

  function elegir(valor: Opcion) {
    if (valor === 'personalizado') {
      setAbierto(true)
      return
    }
    setAbierto(false)
    onCambiar({ tipo: 'preset', rango: valor })
  }

  /* En vivo el poll refresca solo y anunciarlo sería parpadeo; lo que sí hay que
     decir es que el rango recién elegido todavía no llegó. */
  const avisando = desactualizado || (refrescando && !enVivo)

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <Segmentado
        etiqueta="Rango del gráfico"
        valor={opcion}
        opciones={opciones}
        onCambiar={elegir}
        fueraDelPlan={(v) => v !== 'personalizado' && rangoExcedeRetencion(v, retencionDias)}
        numerico
      />
      {personalizado && (
        <div className="flex items-end gap-2">
          <CampoFecha
            etiqueta="Desde"
            valor={desde}
            onCambiar={(d) => d < hasta && onCambiar({ tipo: 'fechas', desde: d, hasta })}
          />
          <span aria-hidden="true" className="pb-2 text-text-faint">
            →
          </span>
          <CampoFecha
            etiqueta="Hasta"
            valor={hasta}
            onCambiar={(d) => d > desde && onCambiar({ tipo: 'fechas', desde, hasta: d })}
          />
        </div>
      )}
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
