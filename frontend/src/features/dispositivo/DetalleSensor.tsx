import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'
import { Vacio } from '@/components/ui/Vacio'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Grafico } from '@/components/graficos/Grafico'
import { IconoActualizar } from '@/components/layout/iconos'
import { estadoHttp } from '@/lib/api'
import { useAhora } from '@/lib/usarCarga'
import { useSesion } from '@/lib/auth'
import { serieDeGrafico } from '@/lib/series'
import { medida } from '@/lib/formato'
import { estadoDispositivo } from '@/lib/tiempo'
import {
  bordesDeVentana,
  esTiempoReal,
  excedeRetencion,
  intervaloEfectivo,
  nombreDeDispositivo,
  resolverVentana,
  useVentanaConZoom,
} from '@/lib/dispositivos'
import { SensorNoEncontradoError, reglaDestacada, useDatosSensor, useDetalleSensorEstatico } from '@/lib/sensor'
import { SelectorVentana } from './SelectorVentana'
import { BloqueHistorial } from './BloqueHistorial'

/* Mismo criterio que el detalle de dispositivo: un único borde derecho para
   que el gráfico no se desalinee con re-renders ajenos al tic. En tiempo real
   se acelera a la par del poll (el intervalo real del equipo), así que el
   "hace X s" del valor actual se mueve al mismo ritmo. Ventanas de fechas
   cerradas en el pasado no se mueven, pero el tic igual corre para el
   "hace X" — barato y sin caso especial. */
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
  const { ventana, elegir, zoomear, restablecer, hayZoom } = useVentanaConZoom({
    tipo: 'preset',
    rango: 'tiempo-real',
  })
  const enVivo = esTiempoReal(ventana)

  const estatico = useDetalleSensorEstatico(id ?? '', sensorId ?? '')
  const polling = useDatosSensor(sensorId ?? '', ventana)
  const tic = useAhora(enVivo && polling.intervaloSeg ? polling.intervaloSeg * 1000 : TIC_MS_DEFAULT)

  if (!id || !sensorId) return <Navegable titulo="Sensor no encontrado" />

  if (estatico.cargando || polling.cargando) return <EsqueletoSensor />

  if (estatico.error && !estatico.datos) {
    const status = estatico.errorCrudo instanceof SensorNoEncontradoError ? 404 : estadoHttp(estatico.errorCrudo)
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
          detalle={estatico.error}
          accion={
            <Boton variante="sutil" onClick={estatico.refrescar}>
              Reintentar
            </Boton>
          }
        />
      </Card>
    )
  }

  if (!estatico.datos) return null

  const { dispositivo, sensor, alertas } = estatico.datos
  const { datos: datosGrafico, ultima } = polling.datos ?? { datos: null, ultima: null }
  const regla = reglaDestacada(alertas, sensor.id)
  const { desde } = resolverVentana(ventana)
  // Borde derecho del gráfico: el tic compartido si la ventana sigue en vivo
  // (preset), o el límite fijo elegido si es un rango de fechas cerrado.
  const { hastaMs: hastaGrilla } = bordesDeVentana(ventana, tic)
  const grilla = datosGrafico ? serieDeGrafico(datosGrafico) : []
  const resumen = datosGrafico?.resumen
  // No se ata al gráfico: el resumen puede traer datos en bordes donde no hay
  // puntos que dibujar, y mostrarlo no depende de que haya trazo.
  const hayResumen = resumen && (resumen.promedio !== null || resumen.minimo !== null || resumen.maximo !== null)
  const hayDatos = datosGrafico !== null && datosGrafico.puntos.length > 0
  const retencionDias = datosGrafico?.retencion_dias ?? null

  const pisoPlan = plan?.plan.intervalo_minimo_seg
  const intervaloSeg = polling.intervaloSeg ?? intervaloEfectivo(dispositivo, pisoPlan)
  const estado = ultima ? estadoDispositivo(ultima.time, intervaloSeg, tic) : 'nunca'
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
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <span className={`num text-display font-semibold ${valorApagado ? 'text-text-muted' : 'text-text'}`}>
            {ultima ? medida(ultima.value, sensor.unidad) : '—'}
          </span>
          <span className="text-note text-text-faint">
            {ultima ? <>Reportó <HaceCuanto iso={ultima.time} /></> : 'Nunca reportó'}
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

      {estatico.error && (
        <p role="alert" className="text-label text-danger">
          No pudimos actualizar: {estatico.error}
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

      <div className="flex flex-wrap items-end gap-3">
        <SelectorVentana ventana={ventana} onCambiar={elegir} retencionDias={retencionDias} />
        {/* Fuera de "En tiempo real" no hay poll (rangos anchos no se mueven
            seguido): esto es lo único que refresca el gráfico y el valor actual. */}
        {!enVivo && (
          <Boton variante="sutil" onClick={polling.refrescar} disabled={polling.refrescando}>
            <IconoActualizar className="size-3.5" />
            Actualizar
          </Boton>
        )}
        {hayZoom && (
          <Boton variante="sutil" onClick={restablecer}>
            Restablecer zoom
          </Boton>
        )}
      </div>

      <Card className="p-4">
        <div className="h-96">
          {hayDatos ? (
            <Grafico
              puntos={grilla}
              color={sensor.color}
              unidad={sensor.unidad}
              desdeMs={new Date(datosGrafico?.desde_efectivo ?? desde).getTime()}
              hastaMs={hastaGrilla}
              umbral={regla?.umbral}
              condicion={regla?.condicion}
              onZoom={zoomear}
              onRestablecer={restablecer}
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
