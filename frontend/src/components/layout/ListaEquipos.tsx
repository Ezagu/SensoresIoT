import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { useAhora } from '@/hooks/usarAhora'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { Skeleton } from '@/components/ui/Skeleton'
import type { DispositivoResumen } from '@/tipos'
import {
  nombreDeDispositivo,
  porNombre,
  situacionDeEquipo,
  type SituacionEquipo,
} from '@/utils/dispositivos'
import { TIC_RELOJ_MS } from '@/utils/tiempo'

export type FilaCartera = { dispositivo: DispositivoResumen; situacion: SituacionEquipo }

/* Orden alfabético y no por gravedad: es navegación, y una lista que se reordena
   sola cada vez que un equipo cambia de estado obliga a buscar de nuevo. La
   gravedad la dicen el glifo y el renglón de "Todos los equipos". */
export function useCartera() {
  const { datos, cargando, actualizadoAt } = useDispositivos()
  const ahora = useAhora(TIC_RELOJ_MS)

  return useMemo(() => {
    const filas: FilaCartera[] = [...(datos ?? [])]
      .sort(porNombre)
      .map((d) => ({ dispositivo: d, situacion: situacionDeEquipo(d, ahora) }))
    const atencion = filas.filter((f) => f.situacion.requiereAtencion).length
    return { filas, atencion, cargando, actualizadoAt }
  }, [datos, cargando, actualizadoAt, ahora])
}

export function textoAtencion(n: number) {
  if (n === 0) return 'En orden'
  return n === 1 ? '1 requiere atención' : `${n} requieren atención`
}

export const TONO_TEXTO: Record<SituacionEquipo['tono'], string> = {
  danger: 'text-danger',
  attention: 'text-attention',
  dim: 'text-text-muted',
  faint: 'text-text-faint',
}

type Variante = 'barra' | 'hoja'

/* La barra lateral y la hoja mobile son la misma lista a dos escalas. */
const FILA: Record<Variante, { fila: string; nombre: string; estado: string }> = {
  barra: {
    fila: 'min-h-13 gap-3 px-2.5 py-2.25 rounded-group',
    nombre: 'text-body-lg',
    estado: 'text-note',
  },
  hoja: {
    fila: 'min-h-14 gap-3.5 px-3 rounded-menu',
    nombre: 'text-heading',
    estado: 'text-note-lg',
  },
}

function claseFila(variante: Variante) {
  return ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center transition-colors duration-130 ${FILA[variante].fila} ${
      isActive ? 'bg-accent-soft' : 'hover:bg-border'
    } ${
      isActive && variante === 'barra'
        ? 'before:absolute before:top-3 before:bottom-3 before:-left-3.5 before:w-0.5 before:bg-accent-strong'
        : ''
    }`
}

function Textos({
  nombre,
  estado,
  tono,
  variante,
}: {
  nombre: string
  estado: string
  tono: SituacionEquipo['tono']
  variante: Variante
}) {
  return (
    <span className="flex min-w-0 flex-col gap-px leading-snug">
      <span className={`truncate font-medium text-text ${FILA[variante].nombre}`}>{nombre}</span>
      <span className={`truncate ${FILA[variante].estado} ${TONO_TEXTO[tono]}`}>{estado}</span>
    </span>
  )
}

export function FilaTodos({ atencion, variante }: { atencion: number; variante: Variante }) {
  return (
    <NavLink to="/" end className={claseFila(variante)}>
      <Textos
        nombre="Todos los equipos"
        estado={textoAtencion(atencion)}
        tono={atencion > 0 ? 'danger' : 'faint'}
        variante={variante}
      />
    </NavLink>
  )
}

export function FilasEquipos({
  filas,
  cargando,
  variante,
}: {
  filas: FilaCartera[]
  cargando: boolean
  variante: Variante
}) {
  if (cargando) {
    return (
      <div className="flex flex-col gap-3 px-2.5 py-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  return filas.map(({ dispositivo: d, situacion }) => (
    <NavLink key={d.id} to={`/dispositivos/${d.id}`} className={claseFila(variante)}>
      <MarcaEstado estado={situacion.glifo} latiendo />
      <Textos
        nombre={nombreDeDispositivo(d.id, d.nombre)}
        estado={situacion.texto}
        tono={situacion.tono}
        variante={variante}
      />
    </NavLink>
  ))
}
