import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { PastillaEquipo, PastillaEstado } from '@/components/ui/PastillaEstado'
import { Vacio } from '@/components/ui/Vacio'
import { ProximoDato } from '@/components/ui/ProximoDato'
import { IconoAjustes, IconoCompartido, IconoExportar, IconoUbicacion } from '@/components/layout/iconos'
import { useAhora } from '@/hooks/usarAhora'
import { estadoDispositivo, TIC_RELOJ_MS } from '@/utils/tiempo'
import { bordesDeVentana, esTiempoReal } from '@/utils/ventana'
import { useVentanaConZoom } from './usarVentana'
import { ETIQUETA_ROL, nombreDeDispositivo, puedeEditar as puedeEditarDispositivo } from '@/utils/dispositivos'
import { limiteDeVentana } from '@/utils/retencion'
import { useTituloPagina } from '@/hooks/usarTitulo'
import { useAlertasDispositivo, useDispositivo, useSensoresConMeta, useEstadoDispositivo } from './usarDispositivo'
import { useGraficosDeSensores } from './usarGraficos'
import type { SensorConDatos } from './usarDispositivo'
import { BloqueSensor } from './BloqueSensor'
import { BloqueAlertas } from './BloqueAlertas'
import { BloqueExport } from './BloqueExport'
import { BarraVentana } from './BarraVentana'
import { AvisoVentana } from './AvisoVentana'
import { ErrorDeCarga, Navegable } from './ErrorDeCarga'
import { TextoError } from '@/components/ui/TextoError'

/* Tantos huecos como sensores tenga el equipo; el 2 es el default de la primera
   carga, cuando todavía no se sabe cuántos son. */
function EsqueletoDetalle({ sensores = 2 }: { sensores?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: Math.max(1, sensores) }, (_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    </div>
  )
}

export function DetalleDispositivo() {
  const { id } = useParams<{ id: string }>()
  const { ventana, elegir, zoomear, restablecer, hayZoom } = useVentanaConZoom({
    tipo: 'preset',
    rango: 'tiempo-real',
  })
  const [exportAbierto, setExportAbierto] = useState(false)

  const equipo = useDispositivo(id ?? '')
  const estado = useEstadoDispositivo(id ?? '')
  const sensores = useSensoresConMeta(id ?? '')
  const graficos = useGraficosDeSensores(sensores.datos ?? [], ventana, estado.cadenciaSeg)
  const { alertas, refrescar: refrescarAlertas } = useAlertasDispositivo(id ?? '', estado.cadenciaSeg)

  const enVivo = esTiempoReal(ventana)
  const hasta = useAhora(enVivo && estado.cadenciaSeg ? estado.cadenciaSeg * 1000 : TIC_RELOJ_MS)

  const dispositivo = equipo.datos
  
  useTituloPagina(dispositivo ? nombreDeDispositivo(dispositivo.id, dispositivo.nombre) : null)

  if (!id) return <Navegable titulo="Dispositivo no encontrado" volverA="/" />

  // Recién con el primer lote real de gráficos se puede pintar la grilla: sin
  // esto, un instante entre "cargó el dispositivo" y "cargó el primer gráfico"
  // mostraría cada tarjeta como "Sin lecturas" en vez de un esqueleto.
  const sensoresBase = sensores.datos ?? []
  const cargandoGrilla = sensoresBase.length > 0 && graficos.porSensor.size === 0
  if (equipo.cargando || sensores.cargando || cargandoGrilla) {
    return <EsqueletoDetalle sensores={sensoresBase.length || undefined} />
  }

  const error = equipo.error ?? sensores.error
  if (error && !dispositivo) {
    return (
      <ErrorDeCarga
        error={error}
        errorCrudo={equipo.errorCrudo ?? sensores.errorCrudo}
        recurso="dispositivo"
        volverA="/"
        onReintentar={equipo.refrescar}
      />
    )
  }

  if (!dispositivo) return null

  const sensoresConDatos: SensorConDatos[] = sensoresBase.map((s) => ({
    ...s,
    datos: graficos.porSensor.get(s.id) ?? null,
  }))
  // Del plan del dueño y no del propio: son los límites de ESTE equipo.
  const { puede_alertas: puedeAlertas, max_alertas: maxAlertas } = dispositivo.limites
  const situacionDispositivo = estadoDispositivo(
    estado.datos?.last_seen_at ?? null,
    estado.datos?.online ?? false,
    dispositivo.intervalo_efectivo_seg,
    hasta,
  )
  // Todos los sensores del dispositivo comparten plan y ventana pedida, así que
  // el primero que traiga datos contesta por todos (recorte y retención).
  const graficoRef = sensoresConDatos.find((s) => s.datos)?.datos ?? null
  const retencionDias = graficoRef?.retencion_dias ?? null
  const disparadas = estado.datos?.alertas_disparadas ?? 0
  const puedeEditar = puedeEditarDispositivo(dispositivo.rol)
  // Ventana única para todas las tarjetas: zoomear en una mueve a todas por igual.
  const { desdeMs: desdePedidoMs, hastaMs } = bordesDeVentana(ventana, hasta)
  const limite = limiteDeVentana(graficoRef, dispositivo.first_connected_at, desdePedidoMs)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/" className="w-fit text-label font-medium text-text-muted hover:text-text">
        ← Panel
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-page-lg font-semibold text-text">
              {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
            </h2>
            {/* role="status": conectividad y alertas cambian solas mientras la
                página está abierta, y son dos preguntas distintas. */}
            <span role="status" aria-atomic="true" className="flex flex-wrap items-center gap-2.5">
              <PastillaEquipo estado={situacionDispositivo} inactivo={!dispositivo.activo} />
              {disparadas > 0 && (
                <PastillaEstado
                  estado="critico"
                  latiendo
                  etiqueta={disparadas === 1 ? '1 alerta disparada' : `${disparadas} alertas disparadas`}
                />
              )}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label text-text-faint">
            {dispositivo.ubicacion && (
              <span className="flex items-center gap-1">
                <IconoUbicacion className="size-3.25" />
                {dispositivo.ubicacion}
              </span>
            )}
            {!estado.datos?.last_seen_at && 
              (
                <span>Nunca reportó</span>
              )
            }
            {/* Sólo con el equipo en línea: en uno caído hace días el contador
                diría "esperando dato" para siempre. */}
            {estado.datos?.online && (
              <span className="num">
                <ProximoDato enSegundos={estado.datos.siguiente_medicion} />
              </span>
            )}
            <span className="flex items-center gap-1">
              <IconoCompartido className="size-3.25" />
              Dueño: {dispositivo.owner_nombre ?? '—'} · Tu rol: {ETIQUETA_ROL[dispositivo.rol]}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Boton variante="fantasma" onClick={() => setExportAbierto(true)}>
            <IconoExportar className="size-3.5" />
            Exportar
          </Boton>
          <BotonLink variante="fantasma" to={`/dispositivos/${dispositivo.id}/ajustes`}>
            <IconoAjustes className="size-3.5" />
            Ajustes
          </BotonLink>
        </div>
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
        refrescar={graficos.refrescar}
        refrescando={graficos.refrescando}
        desactualizado={graficos.desactualizado}
        hayZoom={hayZoom}
        onRestablecer={restablecer}
      />

      <AvisoVentana
        grafico={graficoRef}
        primeraConexion={dispositivo.first_connected_at}
        desdePedidoMs={desdePedidoMs}
      />

      {sensoresConDatos.length === 0 ? (
        <Card>
          <Vacio titulo="Este dispositivo todavía no tiene sensores" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sensoresConDatos.map((sensor) => (
            <BloqueSensor
              key={sensor.id}
              dispositivoId={dispositivo.id}
              sensor={sensor}
              alertas={alertas}
              desdeMs={limite.desdeMs}
              hastaMs={hastaMs}
              corteDePlanMs={limite.corteDePlanMs}
              enVivo={enVivo}
              situacionDispositivo={situacionDispositivo}
              desactualizado={graficos.desactualizado}
              onZoom={zoomear}
              onRestablecer={restablecer}
            />
          ))}
        </div>
      )}

      <BloqueAlertas
        sensores={sensoresBase}
        alertas={alertas}
        puedeAlertas={puedeAlertas}
        puedeEditar={puedeEditar}
        maxAlertas={maxAlertas}
        onCambio={refrescarAlertas}
      />

      {/* Montado sólo mientras está abierto: siembra estado de sus props, y si
          no reabriría con el valor de la vez anterior. */}
      {exportAbierto && (
        <BloqueExport dispositivoId={dispositivo.id} abierto onCerrar={() => setExportAbierto(false)} />
      )}
    </div>
  )
}
