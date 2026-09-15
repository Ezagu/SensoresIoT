import { Link } from 'react-router-dom'
import { Lectura } from '@/components/ui/Lectura'
import { PastillaEstado } from '@/components/ui/PastillaEstado'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Sparkline } from '@/components/graficos/Sparkline'
import { IconoChevron } from '@/components/layout/iconos'
import { serieDeGrafico } from '@/utils/series'
import { numero } from '@/utils/formato'
import { type EstadoDispositivo } from '@/utils/tiempo'
import { reglaDestacada, umbralesDeSensor } from '@/utils/alertas'
import type { SensorConDatos } from './usarDispositivo'
import type { Alerta } from '@/tipos'

/* Qué vigila esta fila. Con más de una regla no se enumeran: el detalle del
   sensor las lista todas y acá lo que importa es que hay algo mirando. */
function CustodiaTexto({
  umbrales,
  unidad,
}: {
  umbrales: ReturnType<typeof umbralesDeSensor>
  unidad: string
}) {
  if (umbrales.length === 0) return <>Sin alertas configuradas</>
  if (umbrales.length > 1) return <>{umbrales.length} reglas activas</>
  const { condicion, umbral } = umbrales[0]
  return (
    <>
      alerta {condicion === 'mayor' ? 'sobre' : 'bajo'}{' '}
      <span className="num font-medium">
        {numero(umbral)} {unidad}
      </span>
    </>
  )
}

export function FilaSensor({
  dispositivoId,
  sensor,
  alertas,
  situacionDispositivo,
}: {
  dispositivoId: string
  sensor: SensorConDatos
  alertas: Alerta[]
  situacionDispositivo: EstadoDispositivo
}) {
  const { datos } = sensor
  const regla = reglaDestacada(alertas, sensor.id)
  const disparada = regla?.estado === 'disparada'
  const umbrales = umbralesDeSensor(alertas, sensor.id)

  const grilla = datos ? serieDeGrafico(datos) : []
  const ultimo = grilla.length > 0 ? datos!.puntos[datos!.puntos.length - 1] : null
  /* Por el equipo y no por el sensor: acá el valor sale del último bucket del
     gráfico, que ya está dentro de la ventana pedida. */
  const apagado = situacionDispositivo !== 'en-linea'

  return (
    <li>
      <Link
        to={`/dispositivos/${dispositivoId}/sensores/${sensor.id}`}
        className={`group flex min-h-13 flex-wrap items-center gap-x-4 gap-y-2 border-l-2 py-3 pr-4 pl-3.5 transition-colors duration-130 hover:bg-surface-2 ${
          disparada ? 'border-l-danger-mark' : 'border-l-transparent'
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="truncate text-body font-medium text-text group-hover:text-accent">
              {sensor.etiqueta}
            </span>
            {disparada && <PastillaEstado estado="critico" etiqueta="Alerta disparada" latiendo />}
          </span>
          <span className="truncate text-note-lg text-text-muted">
            <CustodiaTexto umbrales={umbrales} unidad={sensor.unidad} />
          </span>
        </span>

        {/* Lo primero que se va cuando falta ancho: el nombre y el valor tienen
            que entrar enteros antes que la tendencia. */}
        <span className="hidden sm:block">
          <Sparkline puntos={grilla} tono={disparada ? 'critico' : apagado ? 'apagado' : 'acento'} />
        </span>

        <span className="flex min-w-23 shrink-0 flex-col items-end gap-px">
          <Lectura
            valor={ultimo?.promedio ?? null}
            unidad={sensor.unidad}
            tamano="md"
            tono={disparada ? 'critico' : 'normal'}
            apagado={apagado}
          />
          {/* Sin versalitas: esto no es una etiqueta de columna, es una cifra
              medida (cuánto hace) y va en la familia de lectura. */}
          <span className="num text-note font-medium text-text-muted">
            {ultimo ? <HaceCuanto iso={ultimo.bucket} /> : 'sin lecturas'}
          </span>
        </span>

        <IconoChevron className="hidden size-4 shrink-0 text-text-muted group-hover:text-text sm:block" />
      </Link>
    </li>
  )
}
