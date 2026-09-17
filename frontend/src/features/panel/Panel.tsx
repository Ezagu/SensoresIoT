import { useMemo, useState } from 'react'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { BotonIcono } from '@/components/ui/BotonIcono'
import { Card } from '@/components/ui/Card'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoActualizar, IconoMas } from '@/components/layout/iconos'
import { type Estado } from '@/components/ui/MarcaEstado'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { AccionesCabecera, MetaCabecera } from '@/hooks/usarCabecera'
import { useAhora } from '@/hooks/usarAhora'
import { estadoDispositivo, TIC_RELOJ_MS, type EstadoDispositivo } from '@/utils/tiempo'
import { estadoDeFila, nombreDeDispositivo, ORDEN_GRAVEDAD } from '@/utils/dispositivos'
import { etiquetarSensores } from '@/utils/sensores'
import { FilaDispositivo } from './FilaDispositivo'
import { SeccionEstado } from './SeccionEstado'
import type { DispositivoResumen } from '@/tipos'

type Fila = { dispositivo: DispositivoResumen; conectividad: EstadoDispositivo }

/* Un equipo con retraso está bufferreando y se pone al día solo: no entra acá.
   Uno mudo sí, y para cuando aparece acá el mail de "dejó de reportar" ya salió:
   es el mismo umbral, no dos. Mismo criterio para el veredicto y para el estado
   "atencion" de la fila: las mismas palabras no pueden contar dos cosas
   distintas en la misma pantalla. */
function requiereAtencion({ dispositivo, conectividad }: Fila): boolean {
  if (!dispositivo.activo) return false
  return (
    dispositivo.alertas_disparadas > 0 || conectividad === 'sin-reportar' || conectividad === 'nunca'
  )
}

/* El sensor que está cruzando el umbral, para poder nombrarlo en el veredicto. */
function sensorEnAlerta(dispositivo: DispositivoResumen) {
  const sensor = dispositivo.sensores.find((s) => s.disparada)
  if (!sensor) return null
  return { sensor, etiqueta: etiquetarSensores(dispositivo.sensores).get(sensor.id)!.etiqueta }
}

const ETIQUETA_SECCION: Partial<Record<Estado, string>> = {
  critico: 'Crítico',
  'sin-reportar': 'Sin reportar',
  'sin-datos': 'Nunca reportó',
  atencion: 'Con retraso',
  normal: 'En línea',
  inactivo: 'Desactivados',
}

function EsqueletoFila() {
  return (
    <li className="flex items-center justify-between gap-4 py-3 pr-3.5 pl-3">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-6 w-24" />
    </li>
  )
}

/* La frescura y el refresco viven en la cabecera de la app, no en la pantalla:
   son la misma pregunta en todas y ahí no compiten con el veredicto. */
function CabeceraPanel({
  actualizadoAt,
  refrescando,
  refrescar,
  vincular,
}: {
  actualizadoAt: string | null
  refrescando: boolean
  refrescar: () => void
  vincular: boolean
}) {
  return (
    <>
      <MetaCabecera>
        {refrescando ? (
          <span>actualizando…</span>
        ) : actualizadoAt ? (
          <span className="truncate">
            actualizado <HaceCuanto iso={actualizadoAt} />
          </span>
        ) : null}
      </MetaCabecera>
      <AccionesCabecera>
        <BotonIcono etiqueta="Actualizar" onClick={refrescar} disabled={refrescando}>
          <IconoActualizar className="size-4" />
        </BotonIcono>
        {vincular && (
          <BotonLink to="/vincular">
            <IconoMas className="size-4" />
            Vincular
          </BotonLink>
        )}
      </AccionesCabecera>
    </>
  )
}

export function Panel() {
  const {
    datos: dispositivos,
    cargando,
    refrescando,
    error,
    refrescar,
    cadenciaSeg,
    actualizadoAt,
  } = useDispositivos()

  // El tic del reloj nunca es más lento que el poll del panel: si el equipo
  // más rápido de la cartera reporta cada 15 s, el "hace X" también.
  const ahora = useAhora(
    cadenciaSeg !== undefined ? Math.min(TIC_RELOJ_MS, cadenciaSeg * 1000) : TIC_RELOJ_MS,
  )

  // Colapsadas y no abiertas: así una sección que recién aparece (un equipo
  // que se cae) entra abierta sin lógica extra, en vez de heredar un default
  // que nadie eligió para ese estado.
  const [colapsadas, setColapsadas] = useState<Set<Estado>>(() => new Set())
  function alternar(estado: Estado) {
    setColapsadas((prev) => {
      const next = new Set(prev)
      if (next.has(estado)) next.delete(estado)
      else next.add(estado)
      return next
    })
  }

  const resumen = useMemo(() => {
    const filas: Fila[] = (dispositivos ?? []).map((d) => ({
      dispositivo: d,
      conectividad: estadoDispositivo(d, ahora),
    }))

    return {
      filas,
      requierenAtencion: filas.filter(requiereAtencion).length,
    }
  }, [dispositivos, ahora])

  const total = resumen.filas.length

  const grupos = useMemo(() => {
    const porEstado = new Map<Estado, Fila[]>()
    for (const fila of resumen.filas) {
      const { estado } = estadoDeFila(fila.dispositivo, fila.conectividad)
      const lista = porEstado.get(estado)
      if (lista) lista.push(fila)
      else porEstado.set(estado, [fila])
    }
    return ORDEN_GRAVEDAD.map((estado) => ({ estado, filas: porEstado.get(estado) ?? [] })).filter(
      (g) => g.filas.length > 0,
    )
  }, [resumen.filas])

  // Con exactamente un equipo pidiendo atención, el veredicto lo nombra y dice
  // qué le pasa; con varios o ninguno, la cifra ya es la respuesta completa.
  const atencionUnica = resumen.requierenAtencion === 1 ? resumen.filas.find(requiereAtencion) : undefined

  const veredicto = (() => {
    if (resumen.requierenAtencion === 0) return 'Todo en orden'
    if (atencionUnica) {
      const { dispositivo, conectividad } = atencionUnica
      const nombre = nombreDeDispositivo(dispositivo.id, dispositivo.nombre)
      if (dispositivo.alertas_disparadas > 0) {
        const cruzando = sensorEnAlerta(dispositivo)
        return cruzando ? `${nombre} · ${cruzando.etiqueta} fuera de umbral` : `${nombre} · alerta disparada`
      }
      if (conectividad === 'sin-reportar') return `${nombre} dejó de reportar`
      return `${nombre} nunca reportó`
    }
    return `${resumen.requierenAtencion} equipos requieren atención`
  })()

  const mostrarTotal = resumen.requierenAtencion === 0 || resumen.requierenAtencion > 1

  const cabecera = (
    <CabeceraPanel
      actualizadoAt={actualizadoAt}
      refrescando={refrescando}
      refrescar={refrescar}
      vincular={total > 0}
    />
  )

  if (cargando) {
    return (
      <div className="flex flex-col gap-6">
        {cabecera}
        <Skeleton className="h-7 w-72" />
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            <EsqueletoFila />
            <EsqueletoFila />
          </ul>
        </Card>
      </div>
    )
  }

  if (error && !dispositivos) {
    return (
      <>
        {cabecera}
        <Card>
          <Vacio
            titulo="No pudimos cargar tus dispositivos"
            detalle={error}
            accion={
              <Boton variante="sutil" onClick={refrescar}>
                Reintentar
              </Boton>
            }
          />
        </Card>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {cabecera}
      <section aria-label="Resumen" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-hero font-semibold text-text">{veredicto}</h2>
        {total > 0 && mostrarTotal && (
          <span className="text-body text-text-muted">
            de {total} {total === 1 ? 'equipo vinculado' : 'equipos vinculados'}
          </span>
        )}
      </section>

      {/* Un fallo de poll con datos ya en pantalla es un aviso al costado, no
          un reemplazo: la última foto buena sigue siendo útil. */}
      {error && dispositivos && <TextoError>No pudimos actualizar: {error}</TextoError>}

      <section aria-label="Tus dispositivos" className="flex flex-col gap-3">
        {total === 0 ? (
          <Card>
            <Vacio
              titulo="Todavía no tenés dispositivos"
              detalle="Vinculá tu primer dispositivo con el código impreso en su base y empezá a ver sus lecturas acá."
              accion={
                <BotonLink to="/vincular">
                  <IconoMas className="size-4" />
                  Vincular dispositivo
                </BotonLink>
              }
            />
          </Card>
        ) : (
          grupos.map(({ estado, filas }) => (
            <SeccionEstado
              key={estado}
              estado={estado}
              etiqueta={ETIQUETA_SECCION[estado]!}
              cantidad={filas.length}
              abierta={!colapsadas.has(estado)}
              onAlternar={() => alternar(estado)}
              descripcion={
                estado === 'atencion'
                  ? 'No es una falla: guarda lo que no pudo enviar y se pone al día solo cuando vuelve la conexión.'
                  : undefined
              }
            >
              {filas.map(({ dispositivo, conectividad }) => (
                <FilaDispositivo
                  key={dispositivo.id}
                  dispositivo={dispositivo}
                  conectividad={conectividad}
                  ahora={ahora}
                />
              ))}
            </SeccionEstado>
          ))
        )}
      </section>
    </div>
  )
}
