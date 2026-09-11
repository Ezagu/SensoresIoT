import { useMemo, useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Segmentado } from '@/components/ui/Segmentado'
import { TextoError } from '@/components/ui/TextoError'
import { configurarIntervalo } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { esquemaIntervalo } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'
import type { DispositivoDetalle } from '@/tipos'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'

type PresetValor = '15' | '30' | '60' | '300' | '900' | '1800' | 'otro'

const PRESETS: { valor: PresetValor; etiqueta: string; seg: number | null }[] = [
  { valor: '15', etiqueta: '15 s', seg: 15 },
  { valor: '30', etiqueta: '30 s', seg: 30 },
  { valor: '60', etiqueta: '1 min', seg: 60 },
  { valor: '300', etiqueta: '5 min', seg: 300 },
  { valor: '900', etiqueta: '15 min', seg: 900 },
  { valor: '1800', etiqueta: '30 min', seg: 1800 },
  { valor: 'otro', etiqueta: 'Otro', seg: null }
]

function presetDe(intervaloConfigurado: number | null): PresetValor {
  return PRESETS.find((p) => p.seg === intervaloConfigurado)?.valor ?? 'otro'
}

export function SeccionMuestreo({
  dispositivo,
  puedeEditar,
  onGuardado,
}: {
  dispositivo: DispositivoDetalle
  puedeEditar: boolean
  onGuardado: () => void
}) {
  const pisoPlan = dispositivo.limites.intervalo_minimo_seg
  const presetInicial = presetDe(dispositivo.intervalo_configurado_seg)
  const [preset, setPreset] = useState<PresetValor>(presetInicial)
  // El piso viene del plan del DUEÑO del equipo: se recalcula si el equipo
  // cambia, no se congela en el primer render.
  const esquema = useMemo(() => esquemaIntervalo(pisoPlan), [pisoPlan])
  const { valores, campo, validar } = useFormulario(esquema, {
    intervaloSeg: String(dispositivo.intervalo_configurado_seg ?? pisoPlan),
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const sucio =
    preset !== presetInicial ||
    (preset === 'otro' && valores.intervaloSeg !== String(dispositivo.intervalo_configurado_seg ?? ''))

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setGuardadoOk(false)

    let valorSeg: number | null
    if (preset === 'otro') {
      const datos = validar()
      if (!datos) return
      valorSeg = datos.intervaloSeg
    } else {
      valorSeg = PRESETS.find((p) => p.valor === preset)?.seg ?? null
    }

    setEnviando(true)
    try {
      await configurarIntervalo(dispositivo.id, valorSeg)
      setGuardadoOk(true)
      onGuardado()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos guardar el intervalo.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <SeccionAjustes
      titulo="Muestreo"
      descripcion="Cada cuánto manda una lectura."
    >
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Segmentado
          etiqueta="Intervalo"
          valor={preset}
          opciones={PRESETS.map(({ valor, etiqueta }) => ({ valor, etiqueta }))}
          onCambiar={(v) => {
            setPreset(v)
            setGuardadoOk(false)
          }}
          fueraDelPlan={(valor) => {
            const seg = PRESETS.find((x) => x.valor === valor)?.seg
            return seg !== null && seg !== undefined && seg < pisoPlan
          }}
          mensajeFueraDelPlan={() => `Tu plan no permite bajar de ${pisoPlan} s`}
          disabled={!puedeEditar}
        />

        {preset === 'otro' && (
          <Campo
            etiqueta="Intervalo (segundos)"
            type="number"
            min={pisoPlan}
            max={86400}
            disabled={!puedeEditar}
            {...campo('intervaloSeg')}
          />
        )}

        <div className="flex flex-col gap-1 text-note text-text-faint">
          <p>
            Se aplica en la próxima conexión del equipo.
          </p>
        </div>

        {error && <TextoError>{error}</TextoError>}

        {puedeEditar && (
          <div className="mt-1 flex items-center justify-end gap-3">
            {guardadoOk && (
              <span role="status" className="text-note text-ok">
                Guardado.
              </span>
            )}
            <Boton type="submit" disabled={!sucio || enviando}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        )}
      </form>
    </SeccionAjustes>
  )
}
