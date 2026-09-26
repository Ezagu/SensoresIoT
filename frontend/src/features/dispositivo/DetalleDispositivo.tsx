import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bloque } from '@/components/ui/Bloque'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { PastillaEquipo, PastillaEstado } from '@/components/ui/PastillaEstado'
import { ProximoDato } from '@/components/ui/ProximoDato'
import { Vacio } from '@/components/ui/Vacio'
import { IconoAjustes, IconoExportar, IconoUbicacion } from '@/components/layout/iconos'
import { useAhora } from '@/hooks/usarAhora'
import { MetaCabecera, useRastro } from '@/hooks/usarCabecera'
import { estadoDispositivo, TIC_RELOJ_MS } from '@/utils/tiempo'
import type { Ventana } from '@/utils/ventana'
import { nombreDeDispositivo, puedeEditar as puedeEditarDispositivo } from '@/utils/dispositivos'
import { intervalo } from '@/utils/formato'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { useAlertasDispositivo, useDispositivo, useSensoresConMeta, useEstadoDispositivo } from './usarDispositivo'
import { useGraficosDeSensores } from './usarGraficos'
import type { SensorConDatos } from './usarDispositivo'
import { FilaSensor } from './FilaSensor'
import { PanelEquipo } from './PanelEquipo'
import { BloqueAlertas } from './BloqueAlertas'
import { BloqueExport } from './BloqueExport'
import { ErrorDeCarga, Navegable } from './ErrorDeCarga'
import { TextoError } from '@/components/ui/TextoError'

/* La sparkline de cada fila mira siempre lo que está pasando: esta pantalla no
   tiene selector de rango, el histórico vive en el detalle de cada sensor.
   Constante de módulo porque su identidad es la llave del fetch. */
const EN_VIVO: Ventana = { tipo: 'preset', rango: 'tiempo-real' }

/* Tantos huecos como sensores tenga el equipo; el 2 es el default de la primera
   carga, cuando todavía no se sabe cuántos son. */
function EsqueletoDetalle({ sensores = 2 }: { sensores?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-6 w-56" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className={`w-full ${sensores > 2 ? 'h-80' : 'h-56'}`} />
        <Skeleton className="hidden h-56 w-full xl:block" />
      </div>
    </div>
  )
}

export function DetalleDispositivo() {
  const { id } = useParams<{ id: string }>()
  const [exportAbierto, setExportAbierto] = useState(false)

  const equipo = useDispositivo(id ?? '')
  const estado = useEstadoDispositivo(id ?? '')
  const sensores = useSensoresConMeta(id ?? '')
  const graficos = useGraficosDeSensores(sensores.datos ?? [], EN_VIVO, estado.cadenciaSeg)
  const { alertas, refrescar: refrescarAlertas } = useAlertasDispositivo(id ?? '', estado.cadenciaSeg)

  const hasta = useAhora(estado.cadenciaSeg ? estado.cadenciaSeg * 1000 : TIC_RELOJ_MS)

  const dispositivo = equipo.datos

  useRastro(
    dispositivo
      ? [
          { etiqueta: 'Todos los equipos', a: '/' },
          { etiqueta: nombreDeDispositivo(dispositivo.id, dispositivo.nombre) },
        ]
      : null,
  )

  if (!id) return <Navegable titulo="Dispositivo no encontrado" volverA="/" />

  // Recién con el primer lote real de gráficos se puede pintar la lista: sin
  // esto, un instante entre "cargó el dispositivo" y "cargó el primer gráfico"
  // mostraría cada fila como "sin lecturas" en vez de un esqueleto.
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
  /* Lo que cambia solo sale de /estado; el intervalo, del detalle, que no pollea. */
  const situacionDispositivo = estadoDispositivo(
    {
      last_seen_at: estado.datos?.last_seen_at ?? null,
      last_data_at: estado.datos?.last_data_at ?? null,
      online: estado.datos?.online ?? false,
      intervalo_efectivo_seg: dispositivo.intervalo_efectivo_seg,
      intervalo_modificado_at: estado.datos?.intervalo_modificado_at ?? null,
    },
    hasta,
  )
  // Todos los sensores del dispositivo comparten plan y ventana pedida, así que
  // el primero que traiga datos contesta por todos (recorte y retención).
  const graficoRef = sensoresConDatos.find((s) => s.datos)?.datos ?? null
  const retencionDias = graficoRef?.retencion_dias ?? null
  const disparadas = estado.datos?.alertas_disparadas ?? 0
  const puedeEditar = puedeEditarDispositivo(dispositivo.rol)
  const lastSeenAt = estado.datos?.last_seen_at ?? null

  return (
    <div className="flex flex-col gap-6">
      <MetaCabecera>
        {lastSeenAt ? (
          <span className="truncate">
            última lectura <HaceCuanto iso={lastSeenAt} />
          </span>
        ) : (
          <span>nunca reportó</span>
        )}
      </MetaCabecera>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border pb-3">
        <div className="flex min-w-0 flex-col gap-1.5">
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

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label text-text-muted">
              {dispositivo.ubicacion && (
                <span className="flex items-center gap-1">
                  <IconoUbicacion className="size-3.25" />
                  {dispositivo.ubicacion}
                </span>
              )}
              {/* Sólo con el equipo en línea: en uno caído hace días el contador
                  diría "esperando dato" para siempre. */}
              {estado.datos?.online && estado.datos.siguiente_medicion !== null && (
                <span>
                  <ProximoDato enSegundos={estado.datos.siguiente_medicion} />
                </span>
              )}
            </div>

            {/* Un escalón abajo de los hechos de arriba, y por dos vías a la vez
                (cuerpo y tinta): la nota del equipo es prosa que se lee una vez,
                no un dato que se consulta. Ancho de párrafo, no de página, y sin
                sangría: lo que la separa es el registro, no una indentación que
                desaparece cuando el equipo no tiene ubicación. */}
            {dispositivo.descripcion && (
              <p className="max-w-150 text-pretty text-note text-text-faint">
                {dispositivo.descripcion}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Boton variante="sutil" onClick={() => setExportAbierto(true)}>
            <IconoExportar className="size-3.5" />
            Exportar CSV
          </Boton>
          <BotonLink variante="sutil" to={`/dispositivos/${dispositivo.id}/ajustes`}>
            <IconoAjustes className="size-3.5" />
            Ajustes
          </BotonLink>
        </div>
      </div>

      {error && <TextoError>No pudimos actualizar: {error}</TextoError>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Bloque
            titulo="Sensores"
            subtitulo={`Un dato cada ${intervalo(dispositivo.intervalo_efectivo_seg)}`}
            sinPadding
          >
            {sensoresConDatos.length === 0 ? (
              <Vacio titulo="Este dispositivo todavía no tiene sensores" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {sensoresConDatos.map((sensor) => (
                  <FilaSensor
                    key={sensor.id}
                    dispositivoId={dispositivo.id}
                    sensor={sensor}
                    alertas={alertas}
                    situacionDispositivo={situacionDispositivo}
                  />
                ))}
              </ul>
            )}
          </Bloque>

          <BloqueAlertas
            sensores={sensoresBase}
            alertas={alertas}
            conectividad={situacionDispositivo}
            puedeAlertas={puedeAlertas}
            puedeEditar={puedeEditar}
            maxAlertas={maxAlertas}
            onCambio={refrescarAlertas}
          />
        </div>

        <div className="flex flex-col gap-5">
          <PanelEquipo
            dispositivo={dispositivo}
            lastSeenAt={lastSeenAt}
            retencionDias={retencionDias}
          />
        </div>
      </div>

      {/* Montado sólo mientras está abierto: siembra estado de sus props, y si
          no reabriría con el valor de la vez anterior. */}
      {exportAbierto && (
        <BloqueExport dispositivoId={dispositivo.id} abierto onCerrar={() => setExportAbierto(false)} />
      )}
    </div>
  )
}
