import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilaAjuste } from '@/components/ui/FilaAjuste'
import { Segmentado } from '@/components/ui/Segmentado'
import { TextoError } from '@/components/ui/TextoError'
import { configurarIntervalo } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import type { DispositivoDetalle } from '@/tipos'

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

/* Un equipo guardado en un valor que ya no es preset cae al inmediato superior
   en vez de dejar el control sin ninguna opción marcada. */
function presetDe(segundos: number): PresetValor {
  return (PRESETS.find((p) => p.seg >= segundos) ?? PRESETS[PRESETS.length - 1]).valor
}

/* Guardado inmediato y optimista, como cualquier control de opciones cerradas:
   no hay nada que confirmar. Una opción que el plan no cubre se marca y no se
   manda: el backend la rechazaría con 400. */
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
  const [premium, setPremium] = useState<PresetValor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function elegir(v: PresetValor) {
    setError(null)
    if (!habilitados.includes(segundosDe(v))) {
      setPremium(v)
      return
    }
    setPremium(null)
    const anterior = preset
    setPreset(v)
    setOcupado(true)
    try {
      await configurarIntervalo(dispositivo.id, segundosDe(v))
      onGuardado()
    } catch (err) {
      setPreset(anterior)
      setError(mensajeDeError(err, 'No pudimos guardar el intervalo.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <FilaAjuste id="fila-intervalo" titulo="Publicar cada">
      <Segmentado
        etiqueta="Publicar cada"
        valor={preset}
        opciones={PRESETS.map(({ valor, etiqueta }) => ({ valor, etiqueta }))}
        onCambiar={elegir}
        fueraDelPlan={(valor) => !habilitados.includes(segundosDe(valor))}
        mensajeFueraDelPlan={() => 'Tu plan no permite publicar tan seguido'}
        disabled={!puedeEditar || ocupado}
        numerico
      />
      <p className="mt-2 text-note text-text-faint">
        Mide cada <span className="num">15</span> s. Publicar menos seguido estira la batería. Se
        aplica en el próximo contacto del equipo.
      </p>
      {premium && (
        <p className="mt-1 text-note text-accent">
          Publicar cada{' '}
          <span className="num">{PRESETS.find((p) => p.valor === premium)!.etiqueta}</span> es de
          Premium.{' '}
          <Link to="/plan" className="underline">
            Ver planes
          </Link>
        </p>
      )}
      {error && <TextoError>{error}</TextoError>}
    </FilaAjuste>
  )
}
