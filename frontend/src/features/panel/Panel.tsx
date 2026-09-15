import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner } from '@/components/ui/Banner'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Card } from '@/components/ui/Card'
import { Segmentado } from '@/components/ui/Segmentado'
import { PastillaEstado } from '@/components/ui/PastillaEstado'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoMas } from '@/components/layout/iconos'
import { type Estado } from '@/components/ui/MarcaEstado'
import { useDispositivos } from './usarPanel'
import { useAhora } from '@/hooks/usarAhora'
import { estadoDispositivo, TIC_RELOJ_MS, type EstadoDispositivo } from '@/utils/tiempo'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { etiquetarSensores } from '@/utils/sensores'
import { medida } from '@/utils/formato'
import { estadoDeFila, FilaDispositivo } from './FilaDispositivo'
import type { DispositivoResumen } from '@/tipos'

type Fila = { dispositivo: DispositivoResumen; conectividad: EstadoDispositivo }

type Filtro = 'todos' | 'atencion' | 'en-linea'

const OPCIONES_FILTRO: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'atencion', etiqueta: 'Requieren atención' },
  { valor: 'en-linea', etiqueta: 'En línea' },
]

/* Un equipo con retraso está bufferreando y se pone al día solo: no entra acá.
   Uno mudo pasado el margen sí, y es el caso más importante — no existe alerta
   de "dejó de reportar", así que si el panel no lo muestra no lo muestra nadie.
   Mismo criterio para el veredicto de arriba y para el filtro: las mismas
   palabras no pueden contar dos cosas distintas en la misma pantalla. */
function requiereAtencion({ dispositivo, conectividad }: Fila): boolean {
  if (!dispositivo.activo) return false
  return (
    dispositivo.alertas_disparadas > 0 || conectividad === 'sin-reportar' || conectividad === 'nunca'
  )
}

/* La tira de estados: cuántos equipos hay en cada situación. Sólo se nombra lo
   que existe — una categoría en cero no es información, es ruido. */
function TiraEstados({ filas }: { filas: Fila[] }) {
  const conteo = filas.reduce(
    (acc, { dispositivo, conectividad }) => {
      if (!dispositivo.activo) acc.inactivo++
      else if (dispositivo.alertas_disparadas > 0) acc.critico++
      else if (conectividad === 'con-retraso') acc.atencion++
      else if (conectividad === 'sin-reportar') acc['sin-reportar']++
      else if (conectividad === 'nunca') acc['sin-datos']++
      else acc.normal++
      return acc
    },
    { critico: 0, atencion: 0, 'sin-reportar': 0, 'sin-datos': 0, normal: 0, inactivo: 0 },
  )

  /* Sólo las situaciones que un equipo puede tener hoy: "advertencia" existe en
     el vocabulario de estados pero ningún dato del producto la produce. */
  const items: { estado: keyof typeof conteo & Estado; etiqueta: (n: number) => string }[] = [
    { estado: 'critico', etiqueta: (n) => (n === 1 ? '1 con alerta disparada' : `${n} con alertas disparadas`) },
    { estado: 'atencion', etiqueta: (n) => `${n} con retraso` },
    { estado: 'sin-reportar', etiqueta: (n) => `${n} sin reportar` },
    { estado: 'sin-datos', etiqueta: (n) => (n === 1 ? '1 sin reportar nunca' : `${n} sin reportar nunca`) },
    { estado: 'normal', etiqueta: (n) => (n === 1 ? '1 en línea' : `${n} en línea`) },
    { estado: 'inactivo', etiqueta: (n) => (n === 1 ? '1 desactivado' : `${n} desactivados`) },
  ]

  return (
    <div className="flex flex-wrap gap-x-4.5 gap-y-2 border-b border-border pb-5">
      {items
        .filter(({ estado }) => conteo[estado] > 0)
        .map(({ estado, etiqueta }) => (
          <PastillaEstado
            key={estado}
            estado={estado}
            etiqueta={etiqueta(conteo[estado])}
            capsula={false}
          />
        ))}
    </div>
  )
}

/* El sensor que está cruzando el umbral, para poder nombrarlo en el banner. */
function sensorEnAlerta(dispositivo: DispositivoResumen) {
  const sensor = dispositivo.sensores.find((s) => s.disparada)
  if (!sensor) return null
  return { sensor, etiqueta: etiquetarSensores(dispositivo.sensores).get(sensor.id)!.etiqueta }
}

function BannerAlertas({ filas }: { filas: Fila[] }) {
  const enAlerta = filas.filter(({ dispositivo }) => dispositivo.alertas_disparadas > 0)
  if (enAlerta.length === 0) return null

  const primero = enAlerta[0].dispositivo
  const nombre = nombreDeDispositivo(primero.id, primero.nombre)
  const cruzando = sensorEnAlerta(primero)

  return (
    <Banner
      tono="critico"
      titulo={
        enAlerta.length === 1
          ? cruzando
            ? `${nombre} · ${cruzando.etiqueta} fuera de umbral`
            : `${nombre} · alerta disparada`
          : `${enAlerta.length} equipos con alertas disparadas`
      }
      acciones={
        enAlerta.length === 1 ? (
          <BotonLink variante="primario" to={`/dispositivos/${primero.id}`}>
            Ver equipo
          </BotonLink>
        ) : undefined
      }
    >
      {enAlerta.length === 1 ? (
        /* Sólo lo que el panel sabe de verdad: el valor. El umbral y desde
           cuándo está cruzado viven en el detalle, que es adonde lleva el botón
           — el resumen del panel no los trae (ver nota de API en el README). */
        cruzando !== null && cruzando.sensor.ultimo_valor !== null ? (
          <>
            Última lectura{' '}
            <span className="num font-medium text-text">
              {medida(cruzando.sensor.ultimo_valor, cruzando.sensor.unidad)}
            </span>
            , sobre el umbral de la regla.
          </>
        ) : (
          'El equipo tiene una regla de umbral cruzada.'
        )
      ) : (
        <ul className="flex flex-col gap-0.5">
          {enAlerta.map(({ dispositivo }) => (
            <li key={dispositivo.id}>
              <Link to={`/dispositivos/${dispositivo.id}`} className="font-medium text-text hover:underline">
                {nombreDeDispositivo(dispositivo.id, dispositivo.nombre)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Banner>
  )
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

function ListaEquipos({ filas, ahora }: { filas: Fila[]; ahora: number }) {
  return (
    <Card>
      <ul className="flex flex-col divide-y divide-border">
        {filas.map(({ dispositivo, conectividad }) => (
          <FilaDispositivo
            key={dispositivo.id}
            dispositivo={dispositivo}
            conectividad={conectividad}
            ahora={ahora}
          />
        ))}
      </ul>
    </Card>
  )
}

export function Panel() {
  const { datos: dispositivos, cargando, refrescando, error, refrescar, cadenciaSeg } = useDispositivos()
  const [filtro, setFiltro] = useState<Filtro>('todos')

  // El tic del reloj nunca es más lento que el poll del panel: si el equipo
  // más rápido de la cartera reporta cada 15 s, el "hace X" también.
  const ahora = useAhora(
    cadenciaSeg !== undefined ? Math.min(TIC_RELOJ_MS, cadenciaSeg * 1000) : TIC_RELOJ_MS,
  )

  const resumen = useMemo(() => {
    const filas: Fila[] = (dispositivos ?? []).map((d) => ({
      dispositivo: d,
      conectividad: estadoDispositivo(d.last_seen_at, d.online, d.intervalo_efectivo_seg, ahora),
    }))

    return {
      filas,
      requierenAtencion: filas.filter(requiereAtencion).length,
    }
  }, [dispositivos, ahora])

  const total = resumen.filas.length
  const visibles = useMemo(
    () =>
      resumen.filas.filter((fila) =>
        filtro === 'todos'
          ? true
          : filtro === 'atencion'
            ? requiereAtencion(fila)
            : /* El mismo estado que pinta la fila, y no la conectividad cruda:
                 si no, un equipo con la alerta sonando caería bajo "En línea"
                 mostrando "Alerta disparada" en su propio renglón. */
              estadoDeFila(fila.dispositivo, fila.conectividad).estado === 'normal',
      ),
    [resumen.filas, filtro],
  )

  const veredicto =
    resumen.requierenAtencion === 0
      ? 'Todo en orden'
      : resumen.requierenAtencion === 1
        ? '1 equipo requiere atención'
        : `${resumen.requierenAtencion} equipos requieren atención`

  if (cargando) {
    return (
      <div className="flex flex-col gap-6">
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
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-hero font-semibold text-text">{veredicto}</h2>
          {total > 0 && (
            <span className="text-body text-text-muted">
              de {total} {total === 1 ? 'equipo vinculado' : 'equipos vinculados'}
            </span>
          )}
          {refrescando && (
            <span className="ml-auto text-note text-text-faint">actualizando…</span>
          )}
        </div>
        {total > 0 && <TiraEstados filas={resumen.filas} />}
      </section>

      <BannerAlertas filas={resumen.filas} />

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
          <>
            <Segmentado
              etiqueta="Filtrar equipos"
              valor={filtro}
              opciones={OPCIONES_FILTRO}
              onCambiar={setFiltro}
            />

            {visibles.length === 0 ? (
              <Card>
                <Vacio
                  titulo={
                    filtro === 'atencion'
                      ? 'Ningún equipo requiere atención'
                      : 'Ningún equipo está en línea'
                  }
                  detalle={
                    filtro === 'atencion'
                      ? 'Ninguno tiene una alerta disparada ni dejó de reportar.'
                      : 'Mirá «Todos» para ver en qué estado está cada uno.'
                  }
                  accion={
                    <Boton variante="sutil" onClick={() => setFiltro('todos')}>
                      Ver todos
                    </Boton>
                  }
                />
              </Card>
            ) : (
              <ListaEquipos filas={visibles} ahora={ahora} />
            )}
          </>
        )}
      </section>

      {total > 0 && (
        <p className="text-note-lg text-text-faint">
          Un equipo con retraso no es una falla: guarda lo que no pudo enviar y se pone al día solo
          cuando vuelve la conexión.
        </p>
      )}
    </div>
  )
}
