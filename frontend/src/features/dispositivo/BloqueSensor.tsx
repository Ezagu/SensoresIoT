import { Card } from '@/components/ui/Card'
import { Vacio } from '@/components/ui/Vacio'
import { Grafico } from '@/components/graficos/Grafico'
import { grillaDeGrafico } from '@/lib/series'
import { medida } from '@/lib/formato'
import { reglaDestacada, type RangoGrafico, type SensorConDatos } from '@/lib/dispositivos'
import type { AlertaConNotificar } from '@/lib/tipos'

function Stat({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-text-faint">{etiqueta}</span>
      <span className="num font-medium text-text">{valor}</span>
    </span>
  )
}

export function BloqueSensor({
  sensor,
  alertas,
  rango,
  hasta,
}: {
  sensor: SensorConDatos
  alertas: AlertaConNotificar[]
  rango: RangoGrafico
  hasta: number
}) {
  const { datos } = sensor
  const regla = reglaDestacada(alertas, sensor.id)
  const grilla = datos ? grillaDeGrafico(datos, hasta) : []
  /* La grilla se rellena con null en los buckets sin filas, así que tener
     longitud no implica tener nada que dibujar. */
  const hayDatos = grilla.some((p) => p.valor !== null)
  const resumen = datos?.resumen

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: sensor.color }}
          />
          <h3 className="text-body-lg font-semibold text-text">{sensor.etiqueta}</h3>
        </div>
        {/* Con la tarjeta vacía, "prom — mín — máx —" es sólo ruido */}
        {hayDatos && resumen && (
          <div className="flex gap-3 text-note-lg">
            <Stat etiqueta="prom" valor={resumen.promedio !== null ? medida(resumen.promedio, sensor.unidad) : '—'} />
            <Stat etiqueta="mín" valor={resumen.minimo !== null ? medida(resumen.minimo, sensor.unidad) : '—'} />
            <Stat etiqueta="máx" valor={resumen.maximo !== null ? medida(resumen.maximo, sensor.unidad) : '—'} />
          </div>
        )}
      </div>

      <div className="h-56">
        {hayDatos ? (
          <Grafico
            puntos={grilla}
            color={sensor.color}
            unidad={sensor.unidad}
            rango={rango}
            umbral={regla?.umbral}
            condicion={regla?.condicion}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Vacio
              titulo="Sin lecturas para mostrar"
              detalle="El dispositivo no reportó nada en el rango seleccionado."
            />
          </div>
        )}
      </div>
    </Card>
  )
}
