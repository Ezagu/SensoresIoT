import { Link } from 'react-router-dom'
import { PastillaEquipo } from '@/components/ui/PastillaEstado'
import { PillConteo } from '@/components/ui/Pill'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import {
  IconoAjustes,
  IconoChevron,
  IconoCompartido,
  IconoUbicacion,
} from '@/components/layout/iconos'
import { intervalo as formatoIntervalo } from '@/utils/formato'
import { type EstadoDispositivo } from '@/utils/tiempo'
import { ETIQUETA_ROL, nombreDeDispositivo, puedeEditar } from '@/utils/dispositivos'
import { etiquetarSensores } from '@/utils/sensores'
import type { EquipoInventario } from '../usarInventario'

/* Las columnas se declaran una sola vez y las comparten la cabecera y la fila:
   así no pueden desalinearse. Debajo de md no hay columnas — los valores se
   envuelven y cada uno se nombra solo (de ahí los `md:sr-only`). */
const COL = {
  equipo: 'min-w-0 flex-1',
  sensores: 'min-w-0 md:w-52 md:shrink-0',
  muestreo: 'md:w-20 md:shrink-0 md:text-right',
  alertas: 'md:w-28 md:shrink-0',
  estado: 'md:w-36 md:shrink-0',
  acciones: 'md:w-16 md:shrink-0',
}

/* El rail de 2px corre por toda la lista, cabecera incluida, o las columnas
   arrancarían corridas contra las filas que sí lo pintan. */
const SANGRIA = 'border-l-2 pr-3.5 pl-3'
const COLUMNAS = 'md:flex md:flex-row md:items-center md:gap-4'

/* Rótulos de columna: el único uso de mayúsculas del sistema. Sólo en desktop,
   porque abajo de md las celdas se nombran solas. */
export function CabeceraColumnas() {
  return (
    <li
      aria-hidden="true"
      className={`hidden border-l-transparent bg-surface-2 py-2 text-tag font-semibold tracking-micro text-text-muted uppercase ${SANGRIA} ${COLUMNAS}`}
    >
      <span className={COL.equipo}>Equipo</span>
      <span className={COL.sensores}>Sensores</span>
      <span className={COL.muestreo}>Muestreo</span>
      <span className={COL.alertas}>Alertas</span>
      <span className={COL.estado}>Estado</span>
      <span className={COL.acciones} />
    </li>
  )
}

/* Qué mide el equipo. En texto y no como tira de puntos: el sistema dejó un
   solo color de datos, así que seis puntos iguales no distinguen nada. */
function Sensores({ dispositivo }: { dispositivo: EquipoInventario }) {
  if (!dispositivo.enriquecido || dispositivo.sensores.length === 0) {
    return <span className="text-text-faint">—</span>
  }
  const etiquetas = etiquetarSensores(dispositivo.sensores)
  return <>{dispositivo.sensores.map((s) => etiquetas.get(s.id)!.etiqueta).join(' · ')}</>
}

/* La cobertura, que es la pregunta que ninguna otra pantalla contesta: un equipo
   sin reglas mide y guarda, pero no avisa de nada. */
function Alertas({ dispositivo }: { dispositivo: EquipoInventario }) {
  if (!dispositivo.enriquecido) return <span className="text-text-faint">—</span>

  if (dispositivo.alertas_total === 0) {
    return <span className="text-text-faint">Sin reglas</span>
  }

  return (
    <>
      <span className="num text-text-muted">{dispositivo.alertas_total}</span>
      <span className="text-text-muted md:sr-only">
        &nbsp;{dispositivo.alertas_total === 1 ? 'regla' : 'reglas'}
      </span>
      {dispositivo.alertas_disparadas > 0 && (
        <>
          <PillConteo>{dispositivo.alertas_disparadas}</PillConteo>
          <span className="sr-only">disparadas</span>
        </>
      )}
    </>
  )
}

export function FilaEquipo({
  dispositivo,
  estado,
}: {
  dispositivo: EquipoInventario
  estado: EstadoDispositivo
}) {
  const inactivo = !dispositivo.activo
  const nombre = nombreDeDispositivo(dispositivo.id, dispositivo.nombre)
  const apagado = inactivo ? 'text-text-faint' : 'text-text-muted'

  /* El único acento cromático estructural del sistema: 2px a la izquierda cuando
     la fila pide atención. "Sin reportar" no lo lleva a propósito — el silencio
     no es falla —, pero una regla disparada sí. En estado normal, sin color. */
  const rail = inactivo
    ? 'border-l-transparent'
    : dispositivo.alertas_disparadas > 0
      ? 'border-l-danger-mark'
      : estado === 'con-retraso'
        ? 'border-l-attention-mark'
        : 'border-l-transparent'

  return (
    <li className={`flex flex-col gap-2 py-3 ${SANGRIA} ${COLUMNAS} ${rail}`}>
      <div className={`${COL.equipo} flex flex-col gap-0.5`}>
        <Link
          to={`/dispositivos/${dispositivo.id}`}
          className={`truncate font-display text-body-lg font-semibold hover:text-accent ${
            inactivo ? 'text-text-muted' : 'text-text'
          }`}
        >
          {nombre}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-note text-text-faint">
          {dispositivo.ubicacion && (
            <span className="flex min-w-0 items-center gap-1">
              <IconoUbicacion className="size-3.25 shrink-0" />
              <span className="truncate">{dispositivo.ubicacion}</span>
            </span>
          )}
          {/* De quién es el equipo, o con quién lo compartiste: nunca las dos,
              porque son la misma pregunta vista desde los dos lados. */}
          {dispositivo.rol !== 'owner' ? (
            <span className="flex items-center gap-1">
              <IconoCompartido className="size-3.25 shrink-0" />
              {dispositivo.owner_nombre ?? '—'} · {ETIQUETA_ROL[dispositivo.rol]}
            </span>
          ) : (
            dispositivo.accesos_total > 0 && (
              <span className="flex items-center gap-1">
                <IconoCompartido className="size-3.25 shrink-0" />
                Compartido con <span className="num">{dispositivo.accesos_total}</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* `md:contents` disuelve el grupo en desktop, donde cada celda vuelve a ser
          columna. Abajo de md agrupa lo que si no serían seis renglones apilados:
          la configuración en una línea, la situación en otra. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
        <div className={`${COL.sensores} truncate text-note-lg ${apagado}`}>
          <Sensores dispositivo={dispositivo} />
        </div>

        <div className={`${COL.muestreo} text-note-lg whitespace-nowrap ${apagado}`}>
          <span className="md:sr-only">cada </span>
          <span className="num">{formatoIntervalo(dispositivo.intervalo_efectivo_seg)}</span>
        </div>

        <div className={`${COL.alertas} flex items-center gap-1.5 text-note-lg`}>
          <Alertas dispositivo={dispositivo} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:contents">
        <div
          className={`${COL.estado} flex flex-wrap items-center gap-x-2 gap-y-0.5 md:flex-col md:items-start md:gap-0.5`}
        >
          <PastillaEquipo estado={estado} inactivo={inactivo} />
          {/* Sin lectura no se agrega nada: la pastilla ya dice "Nunca reportó". */}
          {dispositivo.last_seen_at && (
            <span className="num text-note text-text-faint">
              <HaceCuanto iso={dispositivo.last_seen_at} />
            </span>
          )}
        </div>

        <div className={`${COL.acciones} flex items-center gap-0.5 md:justify-end`}>
          {puedeEditar(dispositivo.rol) && (
            <Link
              to={`/dispositivos/${dispositivo.id}/ajustes`}
              aria-label={`Ajustes de ${nombre}`}
              className="flex items-center gap-1 rounded-control px-2 py-1.5 text-note font-medium text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <IconoAjustes className="size-3.5" />
              <span className="md:hidden">Ajustes</span>
            </Link>
          )}
          <Link
            to={`/dispositivos/${dispositivo.id}`}
            aria-label={`Ver detalle de ${nombre}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <IconoChevron className="size-3.75" />
          </Link>
        </div>
      </div>
    </li>
  )
}
