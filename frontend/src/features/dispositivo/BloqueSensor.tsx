import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { Vacio } from '@/components/ui/Vacio'
import { ResumenStats } from '@/components/ui/ResumenStats'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Grafico } from '@/components/graficos/Grafico'
import { serieDeGrafico } from '@/utils/series'
import { medida } from '@/utils/formato'
import { estadoDispositivo } from '@/utils/tiempo'
import { anclaEnCero } from '@/utils/sensores'
import { reglaDestacada, umbralesDeSensor } from '@/utils/alertas'
import type { SensorConDatos } from './usarDispositivo'
import type { AlertaConNotificar } from '@/tipos'

export function BloqueSensor({
  dispositivoId,
  sensor,
  alertas,
  desdeMs,
  hastaMs,
  corteDePlanMs,
  enVivo,
  intervaloSeg,
  desactualizado,
  onZoom,
  onRestablecer,
}: {
  dispositivoId: string
  sensor: SensorConDatos
  alertas: AlertaConNotificar[]
  desdeMs: number
  hastaMs: number
  corteDePlanMs: number | null
  enVivo: boolean
  intervaloSeg: number
  /* El trazo es todavía del rango anterior: una hora de lecturas sobre un eje de
     30 días es indistinguible de un equipo mudo un mes. */
  desactualizado: boolean
  onZoom?: (desdeMs: number, hastaMs: number) => void
  onRestablecer?: () => void
}) {
  const { datos } = sensor
  const regla = reglaDestacada(alertas, sensor.id)
  const disparada = regla?.estado === 'disparada'
  const umbrales = umbralesDeSensor(alertas, sensor.id)
  const grilla = datos ? serieDeGrafico(datos) : []
  const hayDatos = datos !== null && datos.puntos.length > 0
  const resumen = datos?.resumen
  const ultimo = hayDatos ? datos.puntos[datos.puntos.length - 1] : null
  const apagado = ultimo ? estadoDispositivo(ultimo.bucket, intervaloSeg, hastaMs) !== 'en-linea' : true

  return (
    /* @container y no breakpoints de viewport: la misma tarjeta va a una columna
       en mobile y a dos desde md, y a 768px una columna es más angosta que la
       pantalla de un celular. Lo que decide es el ancho de la tarjeta. */
    <Card className="@container flex min-w-0 flex-col gap-3 p-4">
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
        {/* El panel ya pinta este sensor en rojo cuando la regla está disparada:
            sin esto el detalle contradice a la vista de la que se viene. */}
        {disparada && <Pill tono="danger">Alerta disparada</Pill>}
      </div>

      {/* Sólo en vivo: en un rango histórico el valor "actual" no aplica. */}
      {enVivo && ultimo && (
        <div className="flex flex-col gap-2 @md:flex-row @md:items-start @md:justify-between @md:gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {/* role="status": la lectura se renueva sola por polling. El nombre del
                sensor va adentro para que el anuncio diga de cuál habla. */}
            <span
              role="status"
              aria-atomic="true"
              className={`num text-display font-semibold ${
                apagado ? 'text-text-muted' : disparada ? 'text-danger' : 'text-text'
              }`}
            >
              <span className="sr-only">{sensor.etiqueta}: </span>
              {medida(ultimo.promedio, sensor.unidad)}
            </span>
            <span className="text-note text-text-faint">
              Reportó <HaceCuanto iso={ultimo.bucket} />
            </span>
          </div>
          {hayDatos && resumen && <ResumenStats resumen={resumen} unidad={sensor.unidad} />}
        </div>
      )}

      {hayDatos && resumen && !enVivo && <ResumenStats resumen={resumen} unidad={sensor.unidad} />}

      <div className={`h-56 transition-opacity duration-150 ${desactualizado ? 'opacity-60' : ''}`}>
        {hayDatos ? (
          <Grafico
            puntos={grilla}
            color={sensor.color}
            unidad={sensor.unidad}
            etiqueta={sensor.etiqueta}
            desdeMs={desdeMs}
            hastaMs={hastaMs}
            corteDePlanMs={corteDePlanMs}
            umbrales={umbrales}
            desdeCero={anclaEnCero(sensor.tipo)}
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
