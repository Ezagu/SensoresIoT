import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Vacio } from '@/components/ui/Vacio'
import { ResumenStats } from '@/components/ui/ResumenStats'
import { Grafico } from '@/components/graficos/Grafico'
import { serieDeGrafico } from '@/lib/series'
import { reglaDestacada } from '@/lib/alertas'
import type { SensorConDatos } from './cargarSensores'
import type { AlertaConNotificar } from '@/lib/tipos'

export function BloqueSensor({
  dispositivoId,
  sensor,
  alertas,
  desdeMs,
  hastaMs,
  onZoom,
  onRestablecer,
}: {
  dispositivoId: string
  sensor: SensorConDatos
  alertas: AlertaConNotificar[]
  desdeMs: number
  hastaMs: number
  onZoom?: (desdeMs: number, hastaMs: number) => void
  onRestablecer?: () => void
}) {
  const { datos } = sensor
  const regla = reglaDestacada(alertas, sensor.id)
  const grilla = datos ? serieDeGrafico(datos) : []
  const hayDatos = datos !== null && datos.puntos.length > 0
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
          <Link
            to={`/dispositivos/${dispositivoId}/sensores/${sensor.id}`}
            className="text-body-lg font-semibold text-text hover:text-accent"
          >
            {sensor.etiqueta}
          </Link>
        </div>
        {/* Con la tarjeta vacía, "prom — mín — máx —" es sólo ruido */}
        {hayDatos && resumen && <ResumenStats resumen={resumen} unidad={sensor.unidad} />}
      </div>

      <div className="h-56">
        {hayDatos ? (
          <Grafico
            puntos={grilla}
            color={sensor.color}
            unidad={sensor.unidad}
            desdeMs={desdeMs}
            hastaMs={hastaMs}
            umbral={regla?.umbral}
            condicion={regla?.condicion}
            onZoom={onZoom}
            onRestablecer={onRestablecer}
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
