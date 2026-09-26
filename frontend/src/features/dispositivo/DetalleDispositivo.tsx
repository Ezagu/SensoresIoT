import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoChevron } from '@/components/layout/iconos'
import { useAhora } from '@/hooks/usarAhora'
import { useRastro } from '@/hooks/usarCabecera'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { nombreDeDispositivo, puedeEditar as puedeEditarDispositivo } from '@/utils/dispositivos'
import { estadoDispositivo, TIC_RELOJ_MS } from '@/utils/tiempo'
import { bordesDeVentana, type Ventana } from '@/utils/ventana'
import { BloqueAlertas } from './BloqueAlertas'
import { CabeceraEquipo } from './CabeceraEquipo'
import { ErrorDeCarga, Navegable } from './ErrorDeCarga'
import { LineaDeTiempo } from './LineaDeTiempo'
import { estadoDeSensor, ListaSensores, SensorEnAlerta, type Ultima } from './SensoresEquipo'
import {
  useAlertasDispositivo,
  useDispositivo,
  useEstadoDispositivo,
  useEventosDispositivo,
  useSensoresConMeta,
  type SensorConDatos,
} from './usarDispositivo'
import { useGraficosDeSensores } from './usarGraficos'

/* Tendencias y gráfico del sensor en alerta miran siempre las últimas 24 h: el
   rango se elige en el detalle de cada sensor. Constante de módulo porque su
   identidad es la llave del fetch. */
const ULTIMAS_24H: Ventana = { tipo: 'preset', rango: '24h' }
const EVENTOS_VISIBLES = 6

function EsqueletoDetalle() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full max-w-72" />
      <Skeleton className="h-4 w-full max-w-96" />
      <Skeleton className="mt-8 h-56 w-full" />
    </div>
  )
}

export function DetalleDispositivo() {
  const { id = '' } = useParams<{ id: string }>()

  const equipo = useDispositivo(id)
  const estado = useEstadoDispositivo(id)
  const sensores = useSensoresConMeta(id)
  const graficos = useGraficosDeSensores(sensores.datos ?? [], ULTIMAS_24H, estado.cadenciaSeg)
  const { alertas, refrescar: refrescarAlertas } = useAlertasDispositivo(id, estado.cadenciaSeg)
  const { eventos } = useEventosDispositivo(id, estado.cadenciaSeg)
  const cartera = useDispositivos().datos
  const ahora = useAhora(estado.cadenciaSeg ? estado.cadenciaSeg * 1000 : TIC_RELOJ_MS)

  const dispositivo = equipo.datos

  useRastro(
    dispositivo
      ? [
          { etiqueta: 'Todos los equipos', a: '/' },
          { etiqueta: nombreDeDispositivo(dispositivo.id, dispositivo.nombre) },
        ]
      : null,
  )

  /* La última lectura cruda sale del panel, que ya la trae resuelta; si el
     equipo no está en la cartera propia (un admin), del último punto de 24 h. */
  const ultimas = useMemo(() => {
    const delPanel = new Map(
      (cartera?.find((d) => d.id === id)?.sensores ?? []).map((s) => [
        s.id,
        { valor: s.ultimo_valor, at: s.ultimo_at },
      ]),
    )
    const mapa = new Map<string, Ultima>()
    for (const s of sensores.datos ?? []) {
      const punto = graficos.porSensor.get(s.id)?.puntos.at(-1)
      mapa.set(
        s.id,
        delPanel.get(s.id) ?? { valor: punto?.promedio ?? null, at: punto?.bucket ?? null },
      )
    }
    return mapa
  }, [cartera, id, sensores.datos, graficos.porSensor])

  if (!id) return <Navegable titulo="Equipo no encontrado" volverA="/" />

  const sensoresBase = sensores.datos ?? []
  const cargandoGraficos = sensoresBase.length > 0 && graficos.porSensor.size === 0
  if (equipo.cargando || sensores.cargando || cargandoGraficos) return <EsqueletoDetalle />

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

  const conectividad = estadoDispositivo(
    {
      last_seen_at: estado.datos?.last_seen_at ?? null,
      last_data_at: estado.datos?.last_data_at ?? null,
      online: estado.datos?.online ?? false,
      intervalo_efectivo_seg: dispositivo.intervalo_efectivo_seg,
      intervalo_modificado_at: estado.datos?.intervalo_modificado_at ?? null,
    },
    ahora,
  )

  const conDatos: SensorConDatos[] = sensoresBase.map((s) => ({
    ...s,
    datos: graficos.porSensor.get(s.id) ?? null,
  }))
  const estados = new Map(
    conDatos.map((s) => [
      s.id,
      estadoDeSensor(
        s.id,
        alertas,
        ultimas.get(s.id) ?? { valor: null, at: null },
        dispositivo.intervalo_efectivo_seg,
        conectividad,
        ahora,
      ),
    ]),
  )
  const enAlerta = conDatos.filter((s) => estados.get(s.id)!.critico)
  const resto = conDatos.filter((s) => !estados.get(s.id)!.critico)
  const { desdeMs, hastaMs } = bordesDeVentana(ULTIMAS_24H, ahora)

  return (
    <div className="flex flex-col">
      <CabeceraEquipo
        dispositivo={dispositivo}
        sensores={sensoresBase}
        alertas={alertas}
        conectividad={conectividad}
        lastSeenAt={estado.datos?.last_seen_at ?? null}
        lastDataAt={estado.datos?.last_data_at ?? null}
        ahora={ahora}
      />

      {error && <TextoError>No pudimos actualizar: {error}</TextoError>}

      <div className="mt-8 flex flex-col md:mt-9">
        {enAlerta.map((s) => (
          <SensorEnAlerta
            key={s.id}
            dispositivoId={dispositivo.id}
            sensor={s}
            alertas={alertas}
            ultima={ultimas.get(s.id) ?? { valor: null, at: null }}
            desdeMs={desdeMs}
            hastaMs={hastaMs}
          />
        ))}
      </div>

      <div className={enAlerta.length > 0 ? 'mt-12' : ''}>
        {conDatos.length === 0 ? (
          <Vacio titulo="Este equipo todavía no tiene sensores" />
        ) : (
          resto.length > 0 && (
            <ListaSensores
              titulo={enAlerta.length > 0 ? 'Otros sensores' : 'Sensores'}
              dispositivoId={dispositivo.id}
              sensores={resto}
              alertas={alertas}
              ultimas={ultimas}
              estados={estados}
            />
          )
        )}
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <section aria-labelledby="titulo-que-paso">
          <div className="flex min-h-10 items-center justify-between gap-4">
            <h2 id="titulo-que-paso" className="text-heading-lg">
              Qué pasó
            </h2>
            <Link
              to="/avisos"
              className="inline-flex items-center gap-1.5 text-body font-medium text-accent hover:text-text"
            >
              Registro completo
              <IconoChevron className="size-3.5" />
            </Link>
          </div>
          {eventos.length === 0 ? (
            <p className="mt-4 text-body text-text-muted">
              Sin avisos todavía: ninguna regla cambió de estado y el equipo no se cortó.
            </p>
          ) : (
            <LineaDeTiempo eventos={eventos.slice(0, EVENTOS_VISIBLES)} ahora={ahora} />
          )}
        </section>

        <BloqueAlertas
          sensores={sensoresBase}
          alertas={alertas}
          conectividad={conectividad}
          puedeAlertas={dispositivo.limites.puede_alertas}
          puedeEditar={puedeEditarDispositivo(dispositivo.rol)}
          maxAlertas={dispositivo.limites.max_alertas}
          onCambio={refrescarAlertas}
        />
      </div>
    </div>
  )
}
