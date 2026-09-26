import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { Segmentado } from '@/components/ui/Segmentado'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { IconoChevron } from '@/components/layout/iconos'
import { TONO_TEXTO, useCartera } from '@/components/layout/ListaEquipos'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { esAvisoDeEquipo, type AlertaEvento } from '@/tipos'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { FilaEvento } from './FilaEvento'
import { useEventosAlerta } from './usarEventos'

/* El registro de lo que avisó, no el lugar donde se administran las reglas: una
   regla es configuración de un equipo y sólo significa algo al lado de las
   lecturas de su sensor, así que se crea y se edita ahí. */

type Tipo = 'todo' | 'umbrales' | 'conexion'
type Periodo = '7' | '30' | 'todo'

const TIPOS: { valor: Tipo; etiqueta: string }[] = [
  { valor: 'todo', etiqueta: 'Todo' },
  { valor: 'umbrales', etiqueta: 'Umbrales' },
  { valor: 'conexion', etiqueta: 'Conexión' },
]

const fmtDia = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function nombreDia(ms: number, ahora: number) {
  const inicio = (x: number) => new Date(x).setHours(0, 0, 0, 0)
  const dias = Math.round((inicio(ahora) - inicio(ms)) / 86_400_000)
  return dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : null
}

/* Lo que está cruzado ahora sale del panel, no del log: un evento es algo que ya
   pasó y esta banda contesta qué pasa en este momento. */
function Ahora() {
  const { filas } = useCartera()
  const vivos = filas.filter(
    (f) => f.situacion.glifo === 'critico' || f.situacion.glifo === 'sin-reportar',
  )
  if (vivos.length === 0) return null
  return (
    <ul
      aria-label="Ahora"
      className="mt-7 overflow-hidden rounded-menu border border-danger-border bg-danger-soft"
    >
      {vivos.map(({ dispositivo: d, situacion }, i) => (
        <li
          key={d.id}
          className={`grid grid-cols-[1.125rem_minmax(0,1fr)_auto] items-center gap-3.5 px-5 py-3.5 ${
            i > 0 ? 'border-t border-danger-border' : ''
          }`}
        >
          <MarcaEstado estado={situacion.glifo} latiendo />
          <p className="min-w-0 truncate text-body-lg">
            <b className="font-semibold">{nombreDeDispositivo(d.id, d.nombre)}</b>
            <span className={`text-body ${TONO_TEXTO[situacion.tono]}`}> · {situacion.texto}</span>
          </p>
          <Link
            to={`/dispositivos/${d.id}`}
            className="inline-flex items-center gap-1 text-body font-medium text-accent hover:text-text"
          >
            Ver equipo
            <IconoChevron className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Registro({
  dispositivoId,
  tipo,
  periodo,
}: {
  dispositivoId: string | undefined
  tipo: Tipo
  periodo: Periodo
}) {
  const { cadenciaSeg } = useDispositivos()
  const log = useEventosAlerta(cadenciaSeg, dispositivoId)
  const ahora = Date.now()
  const piso = periodo === 'todo' ? 0 : ahora - Number(periodo) * 86_400_000

  const delTipo = (e: AlertaEvento) =>
    tipo === 'todo' || (tipo === 'conexion') === esAvisoDeEquipo(e)
  const visibles = log.eventos.filter(
    (e) => delTipo(e) && new Date(e.medicion_at).getTime() >= piso,
  )
  /* El último tramo ya pasó el piso del período: más atrás no hay nada que mostrar. */
  const masViejo = log.eventos.at(-1)
  const hayMas = log.hayMas && (!masViejo || new Date(masViejo.medicion_at).getTime() >= piso)

  if (log.cargando) {
    return (
      <div className="mt-8 flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (log.error && log.eventos.length === 0) {
    return (
      <Vacio
        titulo="No pudimos cargar los avisos"
        detalle={log.error}
        accion={
          <Boton variante="sutil" onClick={log.reiniciar}>
            Reintentar
          </Boton>
        }
      />
    )
  }

  let diaPrevio = ''

  return (
    <>
      <p className="num mb-5 text-note-lg font-normal tracking-normal text-text-faint">
        {visibles.length} {visibles.length === 1 ? 'aviso' : 'avisos'}
        {hayMas && ' cargados'}
      </p>

      {visibles.length === 0 ? (
        <p className="mt-10 text-body text-text-muted">
          {log.eventos.length === 0
            ? 'Sin avisos todavía. Acá van a aparecer los cruces de umbral de tus equipos y los cortes de los que dejan de reportar.'
            : 'Ningún aviso con estos filtros.'}
        </p>
      ) : (
        <ul>
          {visibles.map((e) => {
            const ms = new Date(e.medicion_at).getTime()
            const dia = new Date(ms).toDateString()
            const abre = dia !== diaPrevio
            diaPrevio = dia
            const relativo = nombreDia(ms, ahora)
            return (
              <Fragment key={e.id}>
                {abre && (
                  <li className="mt-8 flex items-baseline gap-3 border-b border-border-control pb-2 first:mt-0">
                    <h2 className="text-body-lg font-semibold">{relativo ?? fmtDia.format(ms)}</h2>
                    {relativo && (
                      <span className="text-note-lg text-text-faint">{fmtDia.format(ms)}</span>
                    )}
                  </li>
                )}
                <FilaEvento evento={e} anteriores={log.eventos.slice(log.eventos.indexOf(e) + 1)} />
              </Fragment>
            )
          })}
        </ul>
      )}

      {log.error && <TextoError>No pudimos actualizar: {log.error}</TextoError>}

      {/* Se lee hacia atrás y de a poco: lo que hace falta es seguir bajando. */}
      {hayMas && (
        <div className="mt-6 flex justify-center">
          <Boton variante="sutil" disabled={log.cargandoMas} onClick={log.cargarMas}>
            {log.cargandoMas ? 'Cargando…' : 'Avisos anteriores'}
          </Boton>
        </div>
      )}
    </>
  )
}

export function Avisos() {
  const { filas } = useCartera()
  const [equipo, setEquipo] = useState('')
  const [tipo, setTipo] = useState<Tipo>('todo')
  const [periodo, setPeriodo] = useState<Periodo>('7')

  return (
    <div className="flex flex-col">
      <h1 className="text-page md:text-page-lg">Avisos</h1>
      <p className="mt-2 max-w-150 text-body text-text-muted">
        Todo lo que avisó: cruces de umbral y equipos que dejaron de reportar. Las reglas se crean y
        se editan en cada equipo.
      </p>

      <Ahora />

      <div className="mt-9 mb-3 flex flex-wrap items-center gap-3">
        <div className="w-48">
          <Select
            id="avisos-equipo"
            etiqueta="Equipo"
            etiquetaOculta
            value={equipo}
            onChange={(e) => setEquipo(e.target.value)}
          >
            <option value="">Todos los equipos</option>
            {filas.map(({ dispositivo: d }) => (
              <option key={d.id} value={d.id}>
                {nombreDeDispositivo(d.id, d.nombre)}
              </option>
            ))}
          </Select>
        </div>
        <Segmentado etiqueta="Tipo de aviso" valor={tipo} opciones={TIPOS} onCambiar={setTipo} />
        <div className="w-40">
          <Select
            id="avisos-periodo"
            etiqueta="Período"
            etiquetaOculta
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="todo">Todo</option>
          </Select>
        </div>
      </div>

      {/* Cambiar de equipo cambia de log: se remonta en vez de mezclar cursores. */}
      <Registro key={equipo} dispositivoId={equipo || undefined} tipo={tipo} periodo={periodo} />
    </div>
  )
}
