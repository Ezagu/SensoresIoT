import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bloque } from '@/components/ui/Bloque'
import { PastillaEstado } from '@/components/ui/PastillaEstado'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Metrica, TiraMetricas } from '@/components/ui/Metrica'
import { ProximoDato } from '@/components/ui/ProximoDato'
import { Grafico } from '@/components/graficos/Grafico'
import { LeyendaGrafico } from '@/components/graficos/LeyendaGrafico'
import { useAhora } from '@/hooks/usarAhora'
import { huecosDeGrafico, serieDeGrafico } from '@/utils/series'
import { lecturaDesactualizada, TIC_RELOJ_MS } from '@/utils/tiempo'
import { bordesDeVentana, esTiempoReal, resolverVentana } from '@/utils/ventana'
import { useVentanaConZoom } from './usarVentana'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { anclaEnCero } from '@/utils/sensores'
import { limiteDeVentana } from '@/utils/retencion'
import { reglaDestacada, umbralesDeSensor } from '@/utils/alertas'
import { useRastro } from '@/hooks/usarCabecera'
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
import { BloqueExport } from './BloqueExport'
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
  const [exportAbierto, setExportAbierto] = useState(false)
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

  useRastro(
    dispositivo && sensor
      ? [
          { etiqueta: 'Todos los equipos', a: '/' },
          {
            etiqueta: nombreDeDispositivo(dispositivo.id, dispositivo.nombre),
            a: `/dispositivos/${dispositivo.id}`,
          },
          { etiqueta: sensor.etiqueta },
        ]
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

  const huecos = datosGrafico ? huecosDeGrafico(datosGrafico) : { cortes: 0, faltantes: 0 }

  return (
    <div className="flex flex-col gap-5">
      {error && <TextoError>No pudimos actualizar: {error}</TextoError>}

      <AvisoVentana
        grafico={datosGrafico}
        primeraConexion={dispositivo.first_connected_at}
        desdePedidoMs={desde.getTime()}
      />

      {/* El gráfico manda en esta pantalla: es lo primero, lo más alto, y lo que
          gobierna el rango. La pastilla va acá y no en una barra aparte — habla
          de este sensor, que es lo que el cuadro está dibujando. */}
      <Bloque
        destacado
        titulo={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {sensor.etiqueta}
            <span className="font-normal text-text-muted">{sensor.unidad}</span>
            {/* Sólo cuando hay algo que decir: la calma es la ausencia de marcas,
                y un "todo bien" permanente sobre un sensor sin reglas sería
                además una afirmación sobre umbrales que no existen. */}
            {disparada && <PastillaEstado estado="critico" etiqueta="Alerta disparada" latiendo />}
          </span>
        }
        subtitulo={
          estadoEquipo.datos?.online && estadoEquipo.datos.siguiente_medicion !== null ? (
            <span className="num font-normal">
              <ProximoDato enSegundos={estadoEquipo.datos.siguiente_medicion} />
            </span>
          ) : undefined
        }
        acciones={
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
        }
        sinPadding
      >
        <div className="flex flex-col gap-3 p-4">
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

          {hayDatos && (
            <LeyendaGrafico
              bucketSeg={datosGrafico!.bucket_seg}
              hayUmbral={umbrales.length > 0}
              huecos={huecos}
              hayCorteDePlan={limite.corteDePlanMs !== null}
            />
          )}
        </div>
      </Bloque>

      <TiraMetricas>
        {/* role="status": se renueva sola por polling, y el anuncio tiene que
            decir de qué sensor habla. */}
        <div role="status" aria-atomic="true">
          <span className="sr-only">{sensor.etiqueta}: </span>
          <Metrica
            etiqueta="Última lectura"
            valor={ultima?.value ?? null}
            unidad={sensor.unidad}
            tono={disparada ? 'critico' : 'normal'}
            apagado={valorApagado}
            pie={ultima ? <HaceCuanto iso={ultima.time} /> : 'nunca reportó'}
          />
        </div>
        <Metrica
          etiqueta="Promedio"
          valor={hayResumen ? (resumen!.promedio ?? null) : null}
          unidad={sensor.unidad}
          pie="del rango elegido"
        />
        <Metrica
          etiqueta="Máxima"
          valor={hayResumen ? (resumen!.maximo ?? null) : null}
          unidad={sensor.unidad}
        />
        <Metrica
          etiqueta="Mínima"
          valor={hayResumen ? (resumen!.minimo ?? null) : null}
          unidad={sensor.unidad}
        />
        <Metrica
          etiqueta="Puntos"
          valor={datosGrafico?.puntos.length ?? null}
          pie={
            huecos.faltantes > 0 ? (
              <>
                <span className="num">{huecos.faltantes}</span> sin llegar
              </>
            ) : (
              'sin huecos'
            )
          }
        />
      </TiraMetricas>

      <BloqueHistorial
        sensorId={sensor.id}
        unidad={sensor.unidad}
        umbrales={umbrales}
        onExportar={() => setExportAbierto(true)}
      />

      {/* Montado sólo mientras está abierto: siembra estado de sus props. */}
      {exportAbierto && (
        <BloqueExport dispositivoId={dispositivo.id} abierto onCerrar={() => setExportAbierto(false)} />
      )}
    </div>
  )
}
