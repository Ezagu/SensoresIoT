import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { Segmentado } from '@/components/ui/Segmentado'
import { TextoError } from '@/components/ui/TextoError'
import { configurarIntervalo } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import type { DispositivoDetalle } from '@/tipos'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'

/* Lista cerrada, sin valor libre: 137 s no significa nada para nadie y cada
   escalón acá es una decisión que el cliente puede justificar. Espeja
   dispositivo_service.PRESETS_INTERVALO_SEG; cuál habilita el plan lo dice el
   backend en limites.intervalos_disponibles, no se deriva acá. */
const PRESETS = [
  { valor: '60', etiqueta: '1 min', seg: 60 },
  { valor: '300', etiqueta: '5 min', seg: 300 },
  { valor: '900', etiqueta: '15 min', seg: 900 },
  { valor: '1800', etiqueta: '30 min', seg: 1800 },
] as const

type PresetValor = (typeof PRESETS)[number]['valor']

function segundosDe(valor: PresetValor): number {
  return PRESETS.find((p) => p.valor === valor)!.seg
}

/* Antes el intervalo era un número libre, así que puede haber equipos guardados
   en un valor que ya no es preset. Cae al inmediato superior en vez de dejar el
   control sin ninguna opción marcada. */
function presetDe(segundos: number): PresetValor {
  return (PRESETS.find((p) => p.seg >= segundos) ?? PRESETS[PRESETS.length - 1]).valor
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
  const habilitados = dispositivo.limites.intervalos_disponibles
  /* Sin intervalo propio el equipo corre en el piso del plan. */
  const guardado = dispositivo.intervalo_configurado_seg ?? dispositivo.limites.intervalo_minimo_seg

  const [preset, setPreset] = useState<PresetValor>(presetDe(guardado))
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const fueraDelPlan = !habilitados.includes(segundosDe(preset))
  /* Contra los segundos y no contra el preset: un equipo en un valor viejo se
     muestra redondeado y hay que poder guardarlo para normalizarlo. */
  const sucio = segundosDe(preset) !== guardado

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setGuardadoOk(false)
    setEnviando(true)

    try {
      await configurarIntervalo(dispositivo.id, segundosDe(preset))
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
      descripcion="Cada cuánto el equipo guarda un dato en el historial/gráfico."
    >
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Segmentado
          etiqueta="Intervalo"
          valor={preset}
          opciones={PRESETS.map(({ valor, etiqueta }) => ({ valor, etiqueta }))}
          onCambiar={(v) => {
            setPreset(v)
            setGuardadoOk(false)
            setError(null)
          }}
          fueraDelPlan={(valor) => !habilitados.includes(segundosDe(valor))}
          mensajeFueraDelPlan={() => 'Tu plan no permite guardar tan seguido'}
          disabled={!puedeEditar}
          numerico
        />

        <div className="flex flex-col gap-1 text-note text-text-faint">
          <p>
            El dispositivo muestrea cada <span className="num">15</span> segundos, pero sólo guarda un dato cada
            intervalo elegido.
          </p>
          <p>Se aplica en el próximo reporte del dispositivo.</p>
        </div>

        {error && <TextoError>{error}</TextoError>}

        {puedeEditar && (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-3">
            {/* El backend rechaza con 400 un intervalo que el plan no cubre, así
                que en vez de ofrecer un Guardar que va a fallar, se marca y se
                explica qué falta. */}
            {fueraDelPlan && (
              <p className="mr-auto text-note text-accent">
                Guardar cada <span className="num">{PRESETS.find((p) => p.valor === preset)!.etiqueta}</span> es de
                Premium. <Link to="/plan" className="underline">Ver planes</Link>
              </p>
            )}
            {guardadoOk && (
              <span role="status" className="text-note text-ok">
                Guardado.
              </span>
            )}
            <Boton type="submit" disabled={!sucio || enviando || fueraDelPlan}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        )}
      </form>
    </SeccionAjustes>
  )
}
