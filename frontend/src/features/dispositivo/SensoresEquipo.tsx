import { Link } from 'react-router-dom'
import { Grafico } from '@/components/graficos/Grafico'
import { Sparkline } from '@/components/graficos/Sparkline'
import { MarcaEstado, type Estado } from '@/components/ui/MarcaEstado'
import { IconoChevron, IconoPin } from '@/components/layout/iconos'
import type { Alerta } from '@/tipos'
import { reglaDestacada, umbralesDeSensor } from '@/utils/alertas'
import { medida, numero } from '@/utils/formato'
import { anclaEnCero } from '@/utils/sensores'
import { serieDeGrafico } from '@/utils/series'
import { lecturaDesactualizada, type EstadoDispositivo } from '@/utils/tiempo'
import { SIMBOLO_CONDICION } from './alertas/condicion'
import type { SensorConDatos } from './usarDispositivo'

export type Ultima = { valor: number | null; at: string | null }

export type EstadoSensor = { glifo: Estado | null; texto: string; critico: boolean }

/* Una pregunta por sensor: ¿cruzando, mudo, en rango o sin nada que lo mire?
   "En rango" sólo con una regla activa: sin reglas nadie definió el rango. */
export function estadoDeSensor(
  sensorId: string,
  alertas: Alerta[],
  ultima: Ultima,
  intervaloSeg: number,
  conectividad: EstadoDispositivo,
  ahora: number,
): EstadoSensor {
  const regla = reglaDestacada(alertas, sensorId)
  if (regla?.estado === 'disparada')
    return { glifo: 'critico', texto: 'Fuera de rango', critico: true }
  if (conectividad === 'nunca' || conectividad === 'sin-reportar') {
    return { glifo: null, texto: 'Sin evaluar', critico: false }
  }
  if (lecturaDesactualizada(ultima.at, intervaloSeg, ahora)) {
    return { glifo: 'atencion', texto: 'Sin lecturas', critico: false }
  }
  if (regla) return { glifo: 'normal', texto: 'En rango', critico: false }
  return { glifo: null, texto: 'Sin reglas', critico: false }
}

function limite(alertas: Alerta[], sensorId: string, unidad: string) {
  const regla = reglaDestacada(alertas, sensorId)
  return regla ? `${SIMBOLO_CONDICION[regla.condicion]} ${medida(regla.umbral, unidad)}` : null
}

/* El sensor que está cruzando sube al frente con su gráfico de 24 h: es lo
   que vino a mirar quien abrió el equipo después del mail. */
export function SensorEnAlerta({
  dispositivoId,
  sensor,
  alertas,
  ultima,
  desdeMs,
  hastaMs,
}: {
  dispositivoId: string
  sensor: SensorConDatos
  alertas: Alerta[]
  ultima: Ultima
  desdeMs: number
  hastaMs: number
}) {
  const umbrales = umbralesDeSensor(alertas, sensor.id)
  const lim = limite(alertas, sensor.id, sensor.unidad)
  const grilla = sensor.datos ? serieDeGrafico(sensor.datos) : []

  return (
    <section
      aria-label={`${sensor.etiqueta}, fuera de rango`}
      className="relative grid gap-6 border-y border-border-control py-6 before:absolute before:-top-px before:left-0 before:h-0.5 before:w-full before:bg-danger-mark md:grid-cols-[15.5rem_minmax(0,1fr)] md:gap-10 md:before:w-62"
    >
      <div>
        <p className="flex items-center gap-2.5 text-body font-medium text-text-muted">
          <MarcaEstado estado="critico" latiendo />
          {sensor.etiqueta}
        </p>
        <p className="mt-3.5 flex items-baseline gap-1.5">
          <b className="num text-hero leading-none text-danger md:text-alarma">
            {ultima.valor !== null ? numero(ultima.valor) : '—'}
          </b>
          <span className="text-heading-lg text-text-faint">{sensor.unidad}</span>
        </p>
        <p className="mt-2.5 text-body text-text-muted">
          <b className="font-semibold text-danger">Fuera de rango</b>
          {lim && ` · límite ${lim}`}
        </p>
        <Link
          to={`/dispositivos/${dispositivoId}/sensores/${sensor.id}`}
          className="mt-4.5 inline-flex items-center gap-1.5 text-body font-medium text-accent hover:text-text"
        >
          Abrir sensor
          <IconoChevron className="size-3.5" />
        </Link>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-note-lg text-text-muted">
            {sensor.etiqueta} · {sensor.unidad}
          </span>
          <span className="micro">Últimas 24 h</span>
        </div>
        <div className="h-44">
          <Grafico
            puntos={grilla}
            color={sensor.color}
            unidad={sensor.unidad}
            etiqueta={sensor.etiqueta}
            desdeMs={desdeMs}
            hastaMs={hastaMs}
            umbrales={umbrales}
            desdeCero={anclaEnCero(sensor.tipo)}
          />
        </div>
      </div>
    </section>
  )
}

/* Todos los sensores del equipo, el que está en alerta incluido (arriba sube
   además con su gráfico). Ancho fijo para estado, tendencia y valor, así las
   columnas se leen de arriba a abajo. */
export function ListaSensores({
  dispositivoId,
  sensores,
  alertas,
  ultimas,
  estados,
  puedeFijar,
}: {
  dispositivoId: string
  sensores: SensorConDatos[]
  alertas: Alerta[]
  ultimas: Map<string, Ultima>
  estados: Map<string, EstadoSensor>
  /* Dueño y editor fijan; el viewer ve los fijados pero no los cambia. */
  puedeFijar: boolean
}) {
  return (
    <section aria-labelledby="titulo-sensores">
      <h2 id="titulo-sensores" className="text-heading-lg">
        Sensores <span className="font-medium text-text-faint">· {sensores.length}</span>
      </h2>
      <ul className="mt-2.5 border-t border-border-control">
        {sensores.map((s) => {
          const estado = estados.get(s.id)!
          const ultima = ultimas.get(s.id) ?? { valor: null, at: null }
          const lim = estado.critico ? limite(alertas, s.id, s.unidad) : null
          const grilla = s.datos ? serieDeGrafico(s.datos) : []
          return (
            <li
              key={s.id}
              className={`group grid grid-cols-[minmax(0,1fr)_2rem_1rem] items-center gap-x-2 border-b border-border pr-1 transition-colors duration-130 hover:bg-border ${
                estado.critico ? 'border-l-2 border-l-danger-mark bg-danger-soft pl-3' : ''
              }`}
            >
              <Link
                to={`/dispositivos/${dispositivoId}/sensores/${s.id}`}
                className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2 pl-0.5 md:grid-cols-[minmax(0,1fr)_8.75rem_7.5rem_7.5rem] md:gap-x-4.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span
                    className={`truncate text-body-lg font-medium ${estado.critico ? 'text-danger' : 'text-text'}`}
                  >
                    {s.etiqueta}
                  </span>
                  {lim && (
                    <span className="text-tag font-medium text-text-muted">límite {lim}</span>
                  )}
                  <span
                    className={`flex items-center gap-2 text-note md:hidden ${estado.critico ? 'text-danger' : 'text-text-muted'}`}
                  >
                    {estado.glifo && <MarcaEstado estado={estado.glifo} />}
                    {estado.texto}
                  </span>
                </span>
                <span
                  className={`hidden items-center gap-2 text-note-lg md:flex ${
                    estado.critico
                      ? 'text-danger'
                      : estado.glifo
                        ? 'text-text-muted'
                        : 'text-text-faint'
                  }`}
                >
                  {estado.glifo && <MarcaEstado estado={estado.glifo} />}
                  {estado.texto}
                </span>
                <span className="hidden md:block">
                  <Sparkline
                    puntos={grilla}
                    tono={estado.critico ? 'critico' : 'acento'}
                    ancho={120}
                    alto={26}
                    grosor={1.4}
                  />
                </span>
                <span className="text-right whitespace-nowrap">
                  <b
                    className={`num text-metric ${estado.critico ? 'text-danger' : estado.glifo === 'atencion' ? 'text-text-faint' : 'text-text'}`}
                  >
                    {ultima.valor !== null ? numero(ultima.valor) : '—'}
                  </b>
                  <small className="ml-0.75 text-note font-medium text-text-faint">
                    {s.unidad}
                  </small>
                </span>
              </Link>
              {/* PENDIENTE (backend de fijados): el botón está a la vista pero no guarda nada. */}
              {puedeFijar ? (
                <button
                  type="button"
                  disabled
                  aria-label={`Fijar ${s.etiqueta} (pendiente de backend)`}
                  title="Fijar: pendiente de backend"
                  className="flex size-8 cursor-not-allowed items-center justify-center rounded-control text-text-faint md:opacity-0 md:group-hover:opacity-100"
                >
                  <IconoPin className="size-3.75" />
                </button>
              ) : (
                <span />
              )}
              <Link
                to={`/dispositivos/${dispositivoId}/sensores/${s.id}`}
                tabIndex={-1}
                aria-hidden="true"
                className="flex h-full items-center text-text-faint group-hover:text-text"
              >
                <IconoChevron className="size-3.5" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
