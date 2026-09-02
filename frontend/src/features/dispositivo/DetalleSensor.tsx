import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'
import { Vacio } from '@/components/ui/Vacio'
import { Grafico } from '@/components/graficos/Grafico'
import { estadoHttp } from '@/lib/api'
import { useAhora } from '@/lib/usarCarga'
import { useSesion } from '@/lib/auth'
import { serieDeGrafico } from '@/lib/series'
import { medida } from '@/lib/formato'
import { estadoDispositivo, haceCuanto } from '@/lib/tiempo'
import {
  excedeRetencion,
  intervaloEfectivo,
  nombreDeDispositivo,
  resolverVentana,
  type Ventana,
} from '@/lib/dispositivos'
import { SensorNoEncontradoError, reglaDestacada, useDetalleSensor } from '@/lib/sensor'
import { SelectorVentana } from './SelectorVentana'
import { BloqueHistorial } from './BloqueHistorial'

/* Mismo criterio que el detalle de dispositivo: un único borde derecho para
   que el gráfico no se desalinee con re-renders ajenos al tic. En tiempo real
   se acelera a la par del poll, así que el "hace X s" del valor actual se
   mueve al mismo ritmo. Ventanas de fechas cerradas en el pasado no se mueven,
   pero el tic igual corre para el "hace X" — barato y sin caso especial. */
const TIC_MS_TIEMPO_REAL = 15_000
const TIC_MS_DEFAULT = 30_000

function EsqueletoSensor() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

function Navegable({ titulo, dispositivoId }: { titulo: string; dispositivoId?: string }) {
  return (
    <Card>
      <Vacio
        titulo={titulo}
        accion={
          <Link to={dispositivoId ? `/dispositivos/${dispositivoId}` : '/'}>
            <Boton variante="sutil">Volver</Boton>
          </Link>
        }
      />
    </Card>
  )
}

export function DetalleSensor() {
  const { id, sensorId } = useParams<{ id: string; sensorId: string }>()
  const { plan } = useSesion()
  const [ventana, setVentana] = useState<Ventana>({ tipo: 'preset', rango: 'tiempo-real' })
  const enVivo = ventana.tipo === 'preset' && ventana.rango === 'tiempo-real'
  const tic = useAhora(enVivo ? TIC_MS_TIEMPO_REAL : TIC_MS_DEFAULT)

  const { datos, cargando, refrescando, error, errorCrudo, refrescar } = useDetalleSensor(
    id ?? '',
    sensorId ?? '',
    ventana,
  )

  if (!id || !sensorId) return <Navegable titulo="Sensor no encontrado" />

  if (cargando) return <EsqueletoSensor />

  if (error && !datos) {
    const status = errorCrudo instanceof SensorNoEncontradoError ? 404 : estadoHttp(errorCrudo)
    if (status === 404) {
      return (
        <Navegable
          titulo="Este sensor no existe"
          dispositivoId={id}
        />
      )
    }
    if (status === 403) {
      return <Navegable titulo="No tenés acceso a este dispositivo" dispositivoId={id} />
    }
    return (
      <Card>
        <Vacio
          titulo="No pudimos cargar el sensor"
          detalle={error}
          accion={
            <Boton variante="sutil" onClick={refrescar}>
              Reintentar
            </Boton>
          }
        />
      </Card>
    )
  }

  if (!datos) return null

  const { dispositivo, sensor, ultima, alertas } = datos
  const regla = reglaDestacada(alertas, sensor.id)
  const { desde, hasta: hastaVentana } = resolverVentana(ventana)
  // Borde derecho del gráfico: el tic compartido si la ventana sigue en vivo
  // (preset), o el límite fijo elegido si es un rango de fechas cerrado.
  const hastaGrilla = ventana.tipo === 'preset' ? tic : hastaVentana.getTime()
  const grilla = datos.datos ? serieDeGrafico(datos.datos) : []
  const resumen = datos.datos?.resumen
  // No se ata al gráfico: el resumen puede traer datos en bordes donde no hay
  // puntos que dibujar, y mostrarlo no depende de que haya trazo.
  const hayResumen = resumen && (resumen.promedio !== null || resumen.minimo !== null || resumen.maximo !== null)
  const hayDatos = datos.datos !== null && datos.datos.puntos.length > 0
  const retencionDias = datos.datos?.retencion_dias ?? null

  const pisoPlan = plan?.plan.intervalo_minimo_seg
  const estado = ultima
    ? estadoDispositivo(ultima.time, intervaloEfectivo(dispositivo, pisoPlan), tic)
    : 'nunca'
  const valorApagado = estado !== 'en-linea'

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={`/dispositivos/${dispositivo.id}`}
        className="w-fit text-label font-medium text-text-muted hover:text-text"
      >
        ← {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
      </Link>

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full"
          style={{ background: sensor.color }}
        />
        <h2 className="font-display text-page-lg font-semibold text-text">{sensor.etiqueta}</h2>
        {refrescando && <span className="text-note text-text-faint">actualizando…</span>}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <span className={`num text-display font-semibold ${valorApagado ? 'text-text-muted' : 'text-text'}`}>
            {ultima ? medida(ultima.value, sensor.unidad) : '—'}
          </span>
          <span className="text-note text-text-faint">
            {ultima ? `Reportó ${haceCuanto(ultima.time)}` : 'Nunca reportó'}
          </span>
        </div>
        {hayResumen && resumen && (
          <div className="flex gap-4">
            <Stat tamano="md" etiqueta="prom" valor={resumen.promedio !== null ? medida(resumen.promedio, sensor.unidad) : '—'} />
            <Stat tamano="md" etiqueta="mín" valor={resumen.minimo !== null ? medida(resumen.minimo, sensor.unidad) : '—'} />
            <Stat tamano="md" etiqueta="máx" valor={resumen.maximo !== null ? medida(resumen.maximo, sensor.unidad) : '—'} />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-label text-danger">
          No pudimos actualizar: {error}
        </p>
      )}

      {excedeRetencion(desde, retencionDias) && (
        <Card tono="warn" className="flex flex-wrap items-center justify-between gap-3 p-3.5">
          <p className="text-label text-warn">
            Tu plan sólo muestra los últimos {retencionDias} días. El rango pedido se acortó.
          </p>
          <Link to="/plan">
            <Boton variante="sutil">Ver planes</Boton>
          </Link>
        </Card>
      )}

      <SelectorVentana ventana={ventana} onCambiar={setVentana} />

      <Card className="p-4">
        <div className="h-96">
          {hayDatos ? (
            <Grafico
              puntos={grilla}
              color={sensor.color}
              unidad={sensor.unidad}
              desdeMs={new Date(datos.datos?.desde_efectivo ?? desde).getTime()}
              hastaMs={hastaGrilla}
              umbral={regla?.umbral}
              condicion={regla?.condicion}
            />
          ) : (
            <div className="grid h-full place-items-center">
              <Vacio
                titulo="Sin lecturas para mostrar"
                detalle="El sensor no reportó nada en el rango seleccionado."
              />
            </div>
          )}
        </div>
      </Card>

      <BloqueHistorial sensorId={sensor.id} unidad={sensor.unidad} />
    </div>
  )
}
