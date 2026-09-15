import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { ResumenStats } from '@/components/ui/ResumenStats'
import { Grafico } from '@/components/graficos/Grafico'
import { useAhora } from '@/hooks/usarAhora'
import { serieDeGrafico } from '@/utils/series'
import { medida } from '@/utils/formato'
import { lecturaDesactualizada, TIC_RELOJ_MS } from '@/utils/tiempo'
import { bordesDeVentana, esTiempoReal, resolverVentana } from '@/utils/ventana'
import { useVentanaConZoom } from './usarVentana'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { anclaEnCero } from '@/utils/sensores'
import { limiteDeVentana } from '@/utils/retencion'
import { reglaDestacada, umbralesDeSensor } from '@/utils/alertas'
import { useTituloPagina } from '@/hooks/usarTitulo'
import {
  useAlertasDispositivo,
  useDispositivo,
  useEstadoDispositivo,
  useSensoresConMeta,
} from './usarDispositivo'
import { useDatosSensor } from './usarGraficos'
import { BarraVentana } from './BarraVentana'
import { AvisoVentana } from './AvisoVentana'
import { ErrorDeCarga, Navegable } from './ErrorDeCarga'
import { BloqueHistorial } from './BloqueHistorial'
import { TextoError } from '@/components/ui/TextoError'

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
  const { ventana, elegir, zoomear, restablecer, hayZoom } = useVentanaConZoom({
    tipo: 'preset',
    rango: 'tiempo-real',
  })
  const enVivo = esTiempoReal(ventana)

  const equipo = useDispositivo(id ?? '')
  const estadoEquipo = useEstadoDispositivo(id ?? '')
  const sensores = useSensoresConMeta(id ?? '')
  const cadenciaSeg = estadoEquipo.cadenciaSeg
  const polling = useDatosSensor(sensorId ?? '', ventana, cadenciaSeg)
  const tic = useAhora(enVivo && cadenciaSeg ? cadenciaSeg * 1000 : TIC_RELOJ_MS)
  const { alertas: alertasDelEquipo } = useAlertasDispositivo(id ?? '', cadenciaSeg)

  const dispositivo = equipo.datos
  const sensor = sensores.datos?.find((s) => s.id === sensorId)

  useTituloPagina(
    dispositivo && sensor
      ? `${sensor.etiqueta} — ${nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}`
      : null,
  )

  if (!id || !sensorId) return <Navegable titulo="Sensor no encontrado" volverA="/" />

  if (equipo.cargando || sensores.cargando || polling.cargando) return <EsqueletoSensor />

  const error = equipo.error ?? sensores.error
  if (error && !(dispositivo && sensores.datos)) {
    return (
      <ErrorDeCarga
        error={error}
        errorCrudo={equipo.errorCrudo ?? sensores.errorCrudo}
        recurso="sensor"
        volverA={`/dispositivos/${id}`}
        onReintentar={equipo.refrescar}
      />
    )
  }

  if (!dispositivo || !sensores.datos) return null

  /* Un sensorId que no está entre los del equipo es un 404, igual que un
     dispositivo inexistente. */
  if (!sensor) {
    return <Navegable titulo="Este sensor no existe" volverA={`/dispositivos/${id}`} />
  }

  const alertas = alertasDelEquipo.filter((a) => a.sensor_id === sensor.id)
  const datosGrafico = polling.datos?.datos ?? null
  const ultima = polling.datos?.ultima ?? null
  const regla = reglaDestacada(alertas, sensor.id)
  const disparada = regla?.estado === 'disparada'
  const umbrales = umbralesDeSensor(alertas, sensor.id)
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

  // Sobre la última lectura del sensor y no sobre el equipo: lo que se apaga es
  // este valor, que puede estar viejo aunque el equipo siga reportando otros.
  const valorApagado = lecturaDesactualizada(ultima?.time ?? null, dispositivo.intervalo_efectivo_seg, tic)

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
            {ultima ? <>Reportó <span className="num"><HaceCuanto iso={ultima.time} /></span></> : 'Nunca reportó'}
          </span>
        </div>
        {hayResumen && resumen && (
          /* Cuando envuelve se lleva el renglón entero: al ancho del contenido,
             tres valores de cuatro cifras no entran en un celular. */
          <ResumenStats resumen={resumen} unidad={sensor.unidad} tamano="md" className="w-full sm:w-auto" />
        )}
      </div>

      {error && (
        <TextoError>
          No pudimos actualizar: {error}
        </TextoError>
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
              umbrales={umbrales}
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
