import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoChevron, IconoMas } from '@/components/layout/iconos'
import { useCartera } from '@/components/layout/ListaEquipos'
import { useAhora } from '@/hooks/usarAhora'
import { useCarga } from '@/hooks/usarCarga'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { listarEventosAlerta } from '@/services/consultas'
import { esAvisoDeEquipo, type AlertaEvento } from '@/tipos'
import { porNombre } from '@/utils/dispositivos'
import { medida } from '@/utils/formato'
import { etiquetaDeTipo } from '@/utils/sensores'
import { hora, momento, TIC_RELOJ_MS } from '@/utils/tiempo'
import { BloqueAlerta, BloqueSilencio } from './BloqueIncidente'
import { TarjetaEquipo } from './TarjetaEquipo'
import { useIncidentes } from './usarIncidentes'

function queDice(e: AlertaEvento): string {
  const equipo = e.dispositivo_nombre
  if (esAvisoDeEquipo(e))
    return e.tipo === 'sin_reportar' ? `${equipo} dejó de reportar` : `${equipo} volvió a reportar`
  const sensor = e.alerta_nombre ?? etiquetaDeTipo(e.tipo_sensor_nombre)
  return e.tipo === 'disparada'
    ? `${equipo}, ${sensor} llegó a ${medida(e.valor, e.tipo_sensor_unidad)}`
    : `${equipo}, ${sensor} volvió a rango`
}

/* Con todo en orden, lo último que pasó: confirma que el sistema está mirando
   aunque no haya nada que mostrar. */
function UltimoAviso({ ahora }: { ahora: number }) {
  const cargar = useCallback(
    (signal: AbortSignal) => listarEventosAlerta({ limite: 1 }, signal),
    [],
  )
  const evento = useCarga(cargar).datos?.eventos[0]
  if (!evento) return null
  return (
    <p className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-text-faint">
      Último aviso: {momento(evento.medicion_at, ahora)}, {queDice(evento)}.
      <Link
        to="/avisos"
        className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-text"
      >
        Ver avisos
        <IconoChevron className="size-3.5" />
      </Link>
    </p>
  )
}

function Frase({ atencion, total, ahora }: { atencion: number; total: number; ahora: number }) {
  const resto = total - atencion
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <MarcaEstado estado={atencion > 0 ? 'critico' : 'normal'} latiendo className="size-2.5" />
        <span className="micro">Hoy {hora(ahora)}</span>
      </div>
      <h1 className="text-metric-lg leading-tight tracking-tight md:text-hero md:leading-none">
        {atencion === 0 ? (
          <>
            Todo en orden.{' '}
            <span className="text-text-faint">
              {total === 1 ? '1 equipo reportando.' : `${total} equipos reportando.`}
            </span>
          </>
        ) : (
          <>
            {atencion === 1
              ? '1 equipo requiere atención.'
              : `${atencion} equipos requieren atención.`}
            {resto > 0 && (
              <span className="text-text-faint">
                {' '}
                {resto === 1 ? 'El otro, en orden.' : `Los otros ${resto}, en orden.`}
              </span>
            )}
          </>
        )}
      </h1>
    </section>
  )
}

export function Panel() {
  const { datos, error, refrescar, cadenciaSeg } = useDispositivos()
  const { filas, atencion, cargando } = useCartera()
  const ahora = useAhora(
    cadenciaSeg !== undefined ? Math.min(TIC_RELOJ_MS, cadenciaSeg * 1000) : TIC_RELOJ_MS,
  )

  /* Arriba, un bloque por incidente; la grilla lleva el resto, con los que
     piden atención primero. */
  const { alertas, silencios, grilla } = useMemo(() => {
    const alertas = filas.filter((f) => f.situacion.glifo === 'critico')
    const silencios = filas.filter((f) => f.situacion.glifo === 'sin-reportar')
    const grilla = filas
      .filter((f) => f.situacion.glifo !== 'critico' && f.situacion.glifo !== 'sin-reportar')
      .sort(
        (a, b) =>
          Number(b.situacion.requiereAtencion) - Number(a.situacion.requiereAtencion) ||
          porNombre(a.dispositivo, b.dispositivo),
      )
    return { alertas, silencios, grilla }
  }, [filas])

  const incidentes = useIncidentes(
    alertas.map((f) => f.dispositivo.id),
    silencios.map((f) => f.dispositivo.id),
    cadenciaSeg !== undefined ? cadenciaSeg * 1000 : undefined,
  )

  if (cargando) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-11 w-2/3" />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  if (error && !datos) {
    return (
      <Vacio
        titulo="No pudimos cargar tus equipos"
        detalle={error}
        accion={
          <Boton variante="sutil" onClick={refrescar}>
            Reintentar
          </Boton>
        }
      />
    )
  }

  if (filas.length === 0) {
    return (
      <Vacio
        titulo="Todavía no tenés equipos"
        detalle="Vinculá tu primer equipo con el código impreso en su base y empezá a ver sus lecturas acá."
        accion={
          <BotonLink to="/vincular">
            <IconoMas className="size-4" />
            Vincular equipo
          </BotonLink>
        }
      />
    )
  }

  const hayIncidentes = alertas.length + silencios.length > 0
  const grillaPideAtencion = grilla.some((f) => f.situacion.requiereAtencion)

  return (
    <div className="flex flex-col">
      <Frase atencion={atencion} total={filas.length} ahora={ahora} />

      {/* Un fallo de poll con datos en pantalla es un aviso al costado: la
          última foto buena sigue siendo útil. */}
      {error && <TextoError>No pudimos actualizar: {error}</TextoError>}

      {hayIncidentes && (
        <div className="mt-8 flex flex-col gap-3.5 md:mt-10">
          {alertas.map((f) => (
            <BloqueAlerta
              key={f.dispositivo.id}
              fila={f}
              detalle={incidentes?.porAlerta.get(f.dispositivo.id)}
              ahora={ahora}
            />
          ))}
          {silencios.map((f) => (
            <BloqueSilencio
              key={f.dispositivo.id}
              fila={f}
              aviso={incidentes?.porSilencio.get(f.dispositivo.id)?.aviso}
              ahora={ahora}
            />
          ))}
        </div>
      )}

      {grilla.length > 0 && (
        <>
          <h2 className="mt-10 mb-3.5 text-heading md:mt-12">
            {hayIncidentes && !grillaPideAtencion ? 'Sin alertas' : 'Equipos'}
            <span className="ml-1.5 font-medium text-text-faint">{grilla.length}</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {grilla.map((f) => (
              <TarjetaEquipo key={f.dispositivo.id} fila={f} ahora={ahora} />
            ))}
          </div>
        </>
      )}

      {atencion === 0 && <UltimoAviso ahora={ahora} />}
    </div>
  )
}
