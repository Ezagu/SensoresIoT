import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { ResumenStats } from '@/components/ui/ResumenStats'
import { Grafico } from '@/components/graficos/Grafico'
import { useAhora } from '@/lib/usarCarga'
import { useSesion } from '@/lib/auth'
import { serieDeGrafico } from '@/lib/series'
import { medida } from '@/lib/formato'
import { estadoDispositivo, TIC_RELOJ_MS } from '@/lib/tiempo'
import { bordesDeVentana, esTiempoReal, resolverVentana, useVentanaConZoom } from '@/lib/ventana'
import { intervaloEfectivo, nombreDeDispositivo } from '@/lib/dispositivos'
import { anclaEnCero } from '@/lib/sensores'
import { limiteDeVentana } from '@/lib/retencion'
import { reglaDestacada } from '@/lib/alertas'
import { useTituloPagina } from '@/lib/titulo'
import { SensorNoEncontradoError, useDatosSensor, useDetalleSensorEstatico } from './usarDetalleSensor'
import { BarraVentana } from './BarraVentana'
import { AvisoVentana } from './AvisoVentana'
import { ErrorDeCarga, Navegable } from './ErrorDeCarga'
import { BloqueHistorial } from './BloqueHistorial'

function EsqueletoSensor() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-96 w-full" />
    </div>
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
  const tic = useAhora(enVivo && polling.intervaloSeg ? polling.intervaloSeg * 1000 : TIC_RELOJ_MS)

  useTituloPagina(
    estatico.datos
      ? `${estatico.datos.sensor.etiqueta} — ${nombreDeDispositivo(estatico.datos.dispositivo.id, estatico.datos.dispositivo.nombre)}`
      : null,
  )

  if (!id || !sensorId) return <Navegable titulo="Sensor no encontrado" volverA="/" />

  if (estatico.cargando || polling.cargando) return <EsqueletoSensor />

  if (estatico.error && !estatico.datos) {
    return (
      <ErrorDeCarga
        error={estatico.error}
        errorCrudo={estatico.errorCrudo}
        esNoEncontrado={estatico.errorCrudo instanceof SensorNoEncontradoError}
        volverA={`/dispositivos/${id}`}
        tituloNoEncontrado="Este sensor no existe"
        tituloSinAcceso="No tenés acceso a este dispositivo"
        tituloGenerico="No pudimos cargar el sensor"
        onReintentar={estatico.refrescar}
      />
    )
  }

  if (!estatico.datos) return null

  const { dispositivo, sensor, alertas } = estatico.datos
  const datosGrafico = polling.datos?.datos ?? null
  const ultima = polling.datos?.ultima ?? null
  const regla = reglaDestacada(alertas, sensor.id)
  const disparada = regla?.estado === 'disparada'
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
  const limite = limiteDeVentana(datosGrafico, dispositivo.first_connected_at, desde.getTime())

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
        {disparada && <Pill tono="danger">Alerta disparada</Pill>}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-0.5">
          {/* Igual que en BloqueSensor: la lectura se renueva por polling y hay
              que anunciarla, con el nombre del sensor adentro del anuncio. */}
          <span
            role="status"
            aria-atomic="true"
            className={`num text-display font-semibold ${
              valorApagado ? 'text-text-muted' : disparada ? 'text-danger' : 'text-text'
            }`}
          >
            <span className="sr-only">{sensor.etiqueta}: </span>
            {ultima ? medida(ultima.value, sensor.unidad) : '—'}
          </span>
          <span className="text-note text-text-faint">
            {ultima ? <>Reportó <HaceCuanto iso={ultima.time} /></> : 'Nunca reportó'}
          </span>
        </div>
        {hayResumen && resumen && <ResumenStats resumen={resumen} unidad={sensor.unidad} tamano="md" />}
      </div>

      {estatico.error && (
        <p role="alert" className="text-label text-danger">
          No pudimos actualizar: {estatico.error}
        </p>
      )}

      <BarraVentana
        ventana={ventana}
        onCambiar={elegir}
        retencionDias={retencionDias}
        primeraConexion={dispositivo.first_connected_at}
        enVivo={enVivo}
        refrescar={polling.refrescar}
        refrescando={polling.refrescando}
        desactualizado={polling.desactualizado}
        hayZoom={hayZoom}
        onRestablecer={restablecer}
      />

      <AvisoVentana
        grafico={datosGrafico}
        primeraConexion={dispositivo.first_connected_at}
        desdePedidoMs={desde.getTime()}
      />

      <Card className="p-4">
        <div className={`h-96 transition-opacity duration-150 ${polling.desactualizado ? 'opacity-60' : ''}`}>
          {hayDatos ? (
            <Grafico
              puntos={grilla}
              color={sensor.color}
              unidad={sensor.unidad}
              etiqueta={sensor.etiqueta}
              desdeMs={limite.desdeMs}
              hastaMs={hastaGrilla}
              corteDePlanMs={limite.corteDePlanMs}
              umbral={regla?.umbral}
              condicion={regla?.condicion}
              desdeCero={anclaEnCero(sensor.tipo)}
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
