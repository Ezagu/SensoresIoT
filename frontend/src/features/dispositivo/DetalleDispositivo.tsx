import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pill, TONO_POR_ESTADO } from '@/components/ui/Pill'
import { Vacio } from '@/components/ui/Vacio'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { IconoAjustes, IconoCompartido, IconoExportar, IconoUbicacion } from '@/components/layout/iconos'
import { estadoHttp } from '@/lib/api'
import { useAhora } from '@/lib/usarCarga'
import { useSesion } from '@/lib/auth'
import { estadoDispositivo, ETIQUETA_ESTADO } from '@/lib/tiempo'
import {
  bordesDeVentana,
  ETIQUETA_ROL,
  excedeRetencion,
  intervaloEfectivo,
  nombreDeDispositivo,
  resolverVentana,
  useDetalleDispositivo,
  useVentanaConZoom,
} from '@/lib/dispositivos'
import { BloqueSensor } from './BloqueSensor'
import { BloqueAlertas } from './BloqueAlertas'
import { BloqueExport } from './BloqueExport'
import { BloqueIntervalo } from './BloqueIntervalo'
import { SelectorVentana } from './SelectorVentana'

/* Los gráficos comparten un único borde derecho, y sólo avanza con el tic: uno
   por sensor los desalinearía entre sí y movería el eje en cualquier re-render
   ajeno. Mismo criterio que el tic del panel. */
const TIC_MS = 30_000

function EsqueletoDetalle() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export function DetalleDispositivo() {
  const { id } = useParams<{ id: string }>()
  const { plan } = useSesion()
  const { ventana, elegir, zoomear, restablecer, hayZoom } = useVentanaConZoom({
    tipo: 'preset',
    rango: 'tiempo-real',
  })
  const [exportAbierto, setExportAbierto] = useState(false)
  const [intervaloAbierto, setIntervaloAbierto] = useState(false)
  const hasta = useAhora(TIC_MS)

  const { datos, cargando, error, errorCrudo, refrescar } = useDetalleDispositivo(id ?? '', ventana)

  if (!id) return <Navegable titulo="Dispositivo no encontrado" />

  if (cargando) return <EsqueletoDetalle />

  if (error && !datos) {
    const status = estadoHttp(errorCrudo)
    if (status === 404) {
      return <Navegable titulo="Este dispositivo no existe" detalle="Puede que lo hayas desvinculado, o el link esté mal." />
    }
    if (status === 403) {
      return <Navegable titulo="No tenés acceso a este dispositivo" detalle="Pedile al dueño que te comparta el acceso." />
    }
    return (
      <Card>
        <Vacio
          titulo="No pudimos cargar este dispositivo"
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

  const { dispositivo, sensores, alertas } = datos
  const pisoPlan = plan?.plan.intervalo_minimo_seg
  const estado = estadoDispositivo(dispositivo.last_seen_at, intervaloEfectivo(dispositivo, pisoPlan))
  // Todos los sensores del dispositivo comparten plan, así que cualquiera sirve
  const retencionDias = sensores.find((s) => s.datos)?.datos?.retencion_dias ?? null
  const { desde } = resolverVentana(ventana)
  // Ventana única para todas las tarjetas: comparten eje, así que comparten
  // también estos bordes — zoomear en una mueve a todas por igual.
  const { desdeMs, hastaMs } = bordesDeVentana(ventana, hasta)

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
            {dispositivo.activo ? (
              <Pill tono={TONO_POR_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Pill>
            ) : (
              <Pill tono="faint">Desactivado</Pill>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label text-text-faint">
            {dispositivo.ubicacion && (
              <span className="flex items-center gap-1">
                <IconoUbicacion className="size-3.25" />
                {dispositivo.ubicacion}
              </span>
            )}
            <span>
              {dispositivo.last_seen_at ? (
                <>Reportó <HaceCuanto iso={dispositivo.last_seen_at} /></>
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
          <Boton variante="fantasma" onClick={() => setIntervaloAbierto(true)}>
            <IconoAjustes className="size-3.5" />
            Intervalo
          </Boton>
          <Boton variante="sutil" onClick={() => setExportAbierto(true)}>
            <IconoExportar className="size-3.5" />
            Exportar
          </Boton>
        </div>
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-body font-medium text-text-muted">Lecturas</h3>
        <div className="flex flex-wrap items-end gap-3">
          <SelectorVentana ventana={ventana} onCambiar={elegir} retencionDias={retencionDias} />
          {hayZoom && (
            <Boton variante="sutil" onClick={restablecer}>
              Restablecer zoom
            </Boton>
          )}
        </div>
      </div>

      {sensores.length === 0 ? (
        <Card>
          <Vacio titulo="Este dispositivo todavía no tiene sensores" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sensores.map((sensor) => (
            <BloqueSensor
              key={sensor.id}
              dispositivoId={dispositivo.id}
              sensor={sensor}
              alertas={alertas}
              desdeMs={desdeMs}
              hastaMs={hastaMs}
              onZoom={zoomear}
              onRestablecer={restablecer}
            />
          ))}
        </div>
      )}

      <BloqueAlertas
        sensores={sensores}
        alertas={alertas}
        puedeAlertas={plan?.plan.puede_alertas ?? false}
        maxAlertas={plan?.plan.max_alertas ?? null}
        onCambio={refrescar}
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

function Navegable({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <Card>
      <Vacio
        titulo={titulo}
        detalle={detalle}
        accion={
          <Link to="/">
            <Boton variante="sutil">Volver al panel</Boton>
          </Link>
        }
      />
    </Card>
  )
}
