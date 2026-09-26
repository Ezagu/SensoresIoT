import { useEffect, useId, useRef, useState } from 'react'
import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { Boton } from '@/components/ui/Boton'
import { Interruptor } from '@/components/ui/Interruptor'
import { Segmentado } from '@/components/ui/Segmentado'
import { IconoCerrar, IconoExportar, IconoTilde } from '@/components/layout/iconos'
import { entero } from '@/utils/formato'
import type { SensorConMeta } from './usarDispositivo'

/* PENDIENTE (Tier 4.6): no hay backend de informes todavía — ni render de PDF
   ni scheduler. El modal está armado para que la falta se vea; "Generar PDF" y
   el envío semanal quedan deshabilitados hasta que exista. */

type Periodo = 'semana' | 'mes' | 'personalizado'

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'semana', etiqueta: 'Semana pasada' },
  { valor: 'mes', etiqueta: 'Mes pasado' },
  { valor: 'personalizado', etiqueta: 'Personalizado' },
]

const INCLUYE = [
  { clave: 'graficos', etiqueta: 'Gráfico por sensor, con umbrales' },
  { clave: 'metricas', etiqueta: 'Mínimo, máximo, promedio y tiempo fuera de rango' },
  { clave: 'avisos', etiqueta: 'Registro de avisos del período' },
  { clave: 'lecturas', etiqueta: 'Tabla de lecturas', nota: 'Puede sumar decenas de páginas' },
] as const

type Clave = (typeof INCLUYE)[number]['clave']

const fmtRango = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const fmtDia = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

function rangoDe(periodo: Periodo, desdeLibre: string, hastaLibre: string): [Date, Date] {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (periodo === 'semana') {
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - 7)
    const fin = new Date(lunes)
    fin.setDate(lunes.getDate() + 7)
    return [lunes, new Date(fin.getTime() - 60_000)]
  }
  if (periodo === 'mes') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return [inicio, new Date(fin.getTime() - 60_000)]
  }
  return [new Date(`${desdeLibre}T00:00`), new Date(`${hastaLibre}T23:59`)]
}

function aDia(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function ModalInforme({
  abierto,
  onCerrar,
  nombreEquipo,
  sensores,
  intervaloSeg,
  sensoresIniciales,
  rangoInicial,
}: {
  abierto: boolean
  onCerrar: () => void
  nombreEquipo: string
  sensores: SensorConMeta[]
  intervaloSeg: number
  /* Desde el detalle de un sensor: arranca con ese sensor y el rango que se miraba. */
  sensoresIniciales?: string[]
  rangoInicial?: { desde: Date; hasta: Date }
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const [elegidos, setElegidos] = useState<Set<string>>(
    () => new Set(sensoresIniciales ?? sensores.map((s) => s.id)),
  )
  const [periodo, setPeriodo] = useState<Periodo>(rangoInicial ? 'personalizado' : 'semana')
  const [desdeLibre, setDesdeLibre] = useState(
    aDia(rangoInicial?.desde ?? new Date(Date.now() - 7 * 86_400_000)),
  )
  const [hastaLibre, setHastaLibre] = useState(aDia(rangoInicial?.hasta ?? new Date()))
  const [incluye, setIncluye] = useState<Record<Clave, boolean>>({
    graficos: true,
    metricas: true,
    avisos: true,
    lecturas: false,
  })

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  const [desde, hasta] = rangoDe(periodo, desdeLibre, hastaLibre)
  const valido = !Number.isNaN(desde.getTime()) && !Number.isNaN(hasta.getTime()) && desde < hasta
  const lecturas = valido
    ? Math.round((hasta.getTime() - desde.getTime()) / 1000 / intervaloSeg)
    : 0
  const incluidos = sensores.filter((s) => elegidos.has(s.id))

  function alternarSensor(id: string) {
    setElegidos((prev) => {
      const sig = new Set(prev)
      if (sig.has(id)) sig.delete(id)
      else sig.add(id)
      return sig
    })
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      onCancel={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar()
      }}
      className="m-auto max-h-[94dvh] w-[min(94vw,1100px)] overflow-y-auto overscroll-contain rounded-2xl border border-border-control bg-elevated p-0 text-text shadow-modal backdrop:bg-overlay"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_27.5rem]">
        <div className="flex flex-col px-6 pt-7 md:px-10 md:pt-8.5">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h2 id={idTitulo} className="text-title">
                Generar informe
              </h2>
              <p className="mt-1.5 max-w-md text-body-lg leading-relaxed text-text-muted">
                Un PDF listo para presentar: gráfico por sensor, mínimos y máximos, y el registro de
                avisos del período.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors duration-130 hover:bg-border hover:text-text"
            >
              <IconoCerrar className="size-4" />
            </button>
          </div>

          <div className="mt-5">
            <AvisoPendiente>
              la generación del PDF y el envío programado todavía no están en el backend (Tier 4.6).
            </AvisoPendiente>
          </div>

          <div className="mt-6.5">
            <span className="mb-2.5 block text-body font-semibold">Equipo</span>
            <p className="flex h-10.5 items-center rounded-control border border-border-control px-3 text-body-lg">
              {nombreEquipo}
            </p>
          </div>

          <div className="mt-6.5">
            <span className="mb-2.5 block text-body font-semibold">Sensores</span>
            <div className="flex flex-wrap gap-2">
              {sensores.map((s) => {
                const on = elegidos.has(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => alternarSensor(s.id)}
                    className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-body font-medium transition-colors duration-130 ${
                      on
                        ? 'border-accent-border bg-accent-soft text-text'
                        : 'border-border-control text-text-muted hover:text-text'
                    }`}
                  >
                    {on && <IconoTilde className="size-3.5 text-accent" />}
                    {s.etiqueta}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6.5">
            <span className="mb-2.5 block text-body font-semibold">Período</span>
            <Segmentado
              etiqueta="Período"
              valor={periodo}
              opciones={PERIODOS}
              onCambiar={setPeriodo}
            />
            {periodo === 'personalizado' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  aria-label="Desde"
                  value={desdeLibre}
                  max={hastaLibre}
                  onChange={(e) => setDesdeLibre(e.target.value)}
                  className="num h-9 rounded-control border border-border-control bg-transparent px-2.5 text-body font-normal focus:border-accent-border focus:outline-none"
                />
                <span aria-hidden="true" className="text-text-faint">
                  →
                </span>
                <input
                  type="date"
                  aria-label="Hasta"
                  value={hastaLibre}
                  min={desdeLibre}
                  max={aDia(new Date())}
                  onChange={(e) => setHastaLibre(e.target.value)}
                  className="num h-9 rounded-control border border-border-control bg-transparent px-2.5 text-body font-normal focus:border-accent-border focus:outline-none"
                />
              </div>
            )}
            {valido && (
              <p className="mt-2.5 text-body text-text-muted">
                <b className="num font-semibold text-text">
                  {fmtRango.format(desde)} – {fmtRango.format(hasta)}
                </b>{' '}
                · ≈ {entero(lecturas)} lecturas por sensor
              </p>
            )}
          </div>

          <div className="mt-6.5">
            <span className="mb-1 block text-body font-semibold">Incluye</span>
            {INCLUYE.map((o) => (
              <div
                key={o.clave}
                className="flex items-center justify-between gap-4 border-b border-border py-2.75 last:border-b-0"
              >
                <span id={`inf-${o.clave}`} className="text-body-lg">
                  {o.etiqueta}
                  {'nota' in o && (
                    <small className="block text-note text-text-faint">{o.nota}</small>
                  )}
                </span>
                <Interruptor
                  activo={incluye[o.clave]}
                  onCambiar={(v) => setIncluye((prev) => ({ ...prev, [o.clave]: v }))}
                  etiquetaId={`inf-${o.clave}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-border py-4.5 md:pb-6">
            <span className="flex items-center gap-2.5 text-body text-text-muted">
              <Interruptor activo={false} onCambiar={() => {}} etiquetaId="inf-semanal" disabled />
              <span id="inf-semanal">Mandarlo por email todos los lunes</span>
            </span>
            <span className="flex-1" />
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton disabled title="Falta el backend de informes (Tier 4.6)">
              <IconoExportar className="size-4" />
              Generar PDF
            </Boton>
          </div>
        </div>

        <aside
          aria-label="Vista previa"
          className="hidden flex-col items-center gap-3.5 border-l border-border bg-surface px-9 py-8.5 lg:flex"
        >
          <div className="flex self-stretch justify-between">
            <span className="micro">Vista previa</span>
            <span className="micro">Esquema</span>
          </div>
          {/* Se dibuja al doble y se escala a la mitad: así la hoja usa la escala
              tipográfica del sistema en vez de tamaños de 7 px sueltos. */}
          <div className="h-127 w-90 overflow-hidden rounded-xs shadow-overlay">
            <div className="flex h-254 w-180 origin-top-left scale-50 flex-col bg-paper p-13 text-paper-ink">
              <div className="flex items-center justify-between border-b border-paper-line pb-5">
                <span className="inline-flex items-center gap-2 text-brand font-semibold tracking-brand">
                  <span aria-hidden="true" className="h-3.5 w-0.75 bg-accent-strong" />
                  BITÁCORA
                </span>
                <span className="font-mono text-note tracking-micro text-paper-dim">
                  INFORME DE MONITOREO
                </span>
              </div>
              <p className="mt-7 text-page font-semibold">{nombreEquipo}</p>
              <p className="mt-1 text-body-lg text-paper-dim">
                {valido
                  ? `${fmtDia.format(desde)} al ${fmtDia.format(hasta)}`
                  : 'Elegí un período válido'}
                {incluidos.length > 0 && ` · ${incluidos.map((s) => s.etiqueta).join(', ')}`}
              </p>
              {incluye.metricas && (
                <div className="mt-7 grid grid-cols-4 border-t border-paper-line pt-4 text-note text-paper-dim">
                  {['Mínimo', 'Máximo', 'Promedio', 'Fuera de rango'].map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              )}
              {incluye.graficos &&
                incluidos.map((s) => (
                  <div key={s.id} className="mt-6">
                    <p className="text-body text-paper-dim">
                      {s.etiqueta} · {s.unidad}
                    </p>
                    <div className="mt-2 h-24 rounded-chip bg-paper-block" />
                  </div>
                ))}
              {incluye.avisos && (
                <>
                  <p className="mt-7 text-body-lg font-semibold">Avisos del período</p>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="mt-2.5 h-4 rounded-chip bg-paper-block" />
                  ))}
                </>
              )}
              {incluye.lecturas && (
                <>
                  <p className="mt-7 text-body-lg font-semibold">Lecturas</p>
                  <div className="mt-2.5 h-16 rounded-chip bg-paper-block" />
                </>
              )}
              <div className="mt-auto flex justify-between font-mono text-note text-paper-dim">
                <span>Generado el {new Date().toLocaleString('es-AR')}</span>
                <span>1 / —</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </dialog>
  )
}
