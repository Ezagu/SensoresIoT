import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pill, TONO_POR_ESTADO } from '@/components/ui/Pill'
import { Vacio } from '@/components/ui/Vacio'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { IconoAjustes, IconoCompartido, IconoExportar, IconoUbicacion } from '@/components/layout/iconos'
import { useAhora } from '@/lib/usarCarga'
import { estadoDispositivo, ETIQUETA_ESTADO, TIC_RELOJ_MS } from '@/lib/tiempo'
import { bordesDeVentana, esTiempoReal, useVentanaConZoom } from '@/lib/ventana'
import {
  ETIQUETA_ROL,
  intervaloEfectivo,
  nombreDeDispositivo,
  puedeEditarAlertas,
  ultimoReporteEfectivo,
} from '@/lib/dispositivos'
import { limiteDeVentana } from '@/lib/retencion'
import { useTituloPagina } from '@/lib/titulo'
import {
  useAlertasDispositivo,
  useDetalleDispositivo,
  useGraficosDeSensores,
  useUltimoReporte,
} from './usarDetalleDispositivo'
import type { SensorConDatos } from './cargarSensores'
import { BloqueSensor } from './BloqueSensor'
import { BloqueAlertas } from './BloqueAlertas'
import { BloqueExport } from './BloqueExport'
import { BloqueIntervalo } from './BloqueIntervalo'
import { BarraVentana } from './BarraVentana'
import { AvisoVentana } from './AvisoVentana'
import { ErrorDeCarga, Navegable } from './ErrorDeCarga'

/* Tantos huecos como sensores tenga el equipo. Dos fijos garantizaban un salto
   de layout en todo equipo que no tuviera exactamente dos; el 2 acá es sólo el
   default de la primera carga, cuando todavía no se sabe cuántos son. */
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
  const [intervaloAbierto, setIntervaloAbierto] = useState(false)

  const { datos, cargando, error, errorCrudo, refrescar } = useDetalleDispositivo(id ?? '')
  const sensoresBase = datos?.sensores ?? []
  const graficos = useGraficosDeSensores(sensoresBase, ventana)
  const lastSeenAt = useUltimoReporte(id ?? '', graficos.intervaloSeg)
  const { alertas, refrescar: refrescarAlertas } = useAlertasDispositivo(id ?? '', graficos.intervaloSeg)

  const enVivo = esTiempoReal(ventana)
  const hasta = useAhora(enVivo && graficos.intervaloSeg ? graficos.intervaloSeg * 1000 : TIC_RELOJ_MS)

  useTituloPagina(datos ? nombreDeDispositivo(datos.dispositivo.id, datos.dispositivo.nombre) : null)

  if (!id) return <Navegable titulo="Dispositivo no encontrado" volverA="/" />

  // Recién con el primer lote real de gráficos se puede pintar la grilla: sin
  // esto, un instante entre "cargó el dispositivo" y "cargó el primer gráfico"
  // mostraría cada tarjeta como "Sin lecturas" en vez de un esqueleto.
  const cargandoGrilla = sensoresBase.length > 0 && graficos.porSensor.size === 0
  if (cargando || cargandoGrilla) return <EsqueletoDetalle sensores={sensoresBase.length || undefined} />

  if (error && !datos) {
    return (
      <ErrorDeCarga
        error={error}
        errorCrudo={errorCrudo}
        volverA="/"
        tituloNoEncontrado="Este dispositivo no existe"
        detalleNoEncontrado="Puede que lo hayas desvinculado, o el link esté mal."
        tituloSinAcceso="No tenés acceso a este dispositivo"
        tituloGenerico="No pudimos cargar este dispositivo"
        onReintentar={refrescar}
      />
    )
  }

  if (!datos) return null

  const { dispositivo, sensores } = datos
  const sensoresConDatos: SensorConDatos[] = sensores.map((s) => ({
    ...s,
    datos: graficos.porSensor.get(s.id) ?? null,
  }))
  // Del plan del dueño y no del propio: son los límites de ESTE equipo.
  const { puede_alertas: puedeAlertas, max_alertas: maxAlertas, intervalo_minimo_seg: pisoPlan } =
    dispositivo.limites
  const intervaloSeg = graficos.intervaloSeg ?? intervaloEfectivo(dispositivo, pisoPlan)
  const ultimoReporte = ultimoReporteEfectivo(lastSeenAt ?? dispositivo.last_seen_at, sensoresConDatos)
  const estado = estadoDispositivo(ultimoReporte, intervaloSeg, hasta)
  // Todos los sensores del dispositivo comparten plan y ventana pedida, así que
  // el primero que traiga datos contesta por todos (recorte y retención).
  const graficoRef = sensoresConDatos.find((s) => s.datos)?.datos ?? null
  const retencionDias = graficoRef?.retencion_dias ?? null
  const disparadas = alertas.filter((a) => a.activa && a.estado === 'disparada').length
  const puedeEditar = puedeEditarAlertas(dispositivo.rol)
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
            {/* Conectividad y alertas son dos preguntas distintas: un equipo
                puede estar en línea justamente porque está reportando el valor
                que disparó la regla. role="status" porque las dos cambian solas
                mientras la página está abierta. */}
            <span role="status" aria-atomic="true" className="flex flex-wrap items-center gap-2.5">
              {dispositivo.activo ? (
                <Pill tono={TONO_POR_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Pill>
              ) : (
                <Pill tono="faint">Desactivado</Pill>
              )}
              {disparadas > 0 && (
                <Pill tono="danger">
                  {disparadas === 1 ? '1 alerta disparada' : `${disparadas} alertas disparadas`}
                </Pill>
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
            <span>
              {ultimoReporte ? (
                <>Reportó <HaceCuanto iso={ultimoReporte} /></>
              ) : (
                'Nunca reportó'
              )}
            </span>
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
          <Boton variante="fantasma" onClick={() => setIntervaloAbierto(true)}>
            <IconoAjustes className="size-3.5" />
            Ajustes
          </Boton>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-label text-danger">
          No pudimos actualizar: {error}
        </p>
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
              intervaloSeg={intervaloSeg}
              desactualizado={graficos.desactualizado}
              onZoom={zoomear}
              onRestablecer={restablecer}
            />
          ))}
        </div>
      )}

      <BloqueAlertas
        sensores={sensores}
        alertas={alertas}
        puedeAlertas={puedeAlertas}
        puedeEditar={puedeEditar}
        maxAlertas={maxAlertas}
        onCambio={refrescarAlertas}
      />

      {/* Montados sólo mientras están abiertos: los dos siembran estado de sus
          props, y montados de forma permanente reabrirían con lo de la vez
          anterior en vez de con el valor recién guardado. */}
      {exportAbierto && (
        <BloqueExport dispositivoId={dispositivo.id} abierto onCerrar={() => setExportAbierto(false)} />
      )}

      {intervaloAbierto && (
        <BloqueIntervalo
          dispositivoId={dispositivo.id}
          intervaloConfigurado={dispositivo.intervalo_configurado_seg}
          pisoPlan={pisoPlan}
          abierto
          onCerrar={() => setIntervaloAbierto(false)}
          onGuardado={() => {
            setIntervaloAbierto(false)
            refrescar()
          }}
        />
      )}
    </div>
  )
}
