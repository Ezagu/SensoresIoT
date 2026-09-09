import type { ReactNode } from 'react'
import { CampoBusqueda } from '@/components/ui/CampoBusqueda'
import { Select } from '@/components/ui/Campo'
import { Segmentado } from '@/components/ui/Segmentado'
import { ETIQUETA_FILTRO, ETIQUETA_ORDEN, type FiltroInventario, type OrdenInventario } from '../inventario'

/* Orden fijo de exhibición: gravedad primero, la baja al final (no es una
   falla de conexión, no compite con las demás). */
const CATEGORIAS: FiltroInventario[] = ['en-linea', 'retraso', 'sin-reportar', 'nunca', 'desactivado']

type EstadoFiltro = FiltroInventario | 'todos'

export function BarraInventario({
  texto,
  onTexto,
  estado,
  onEstado,
  conteos,
  total,
  orden,
  onOrden,
  accion,
}: {
  texto: string
  onTexto: (valor: string) => void
  estado: EstadoFiltro
  onEstado: (valor: EstadoFiltro) => void
  conteos: Record<FiltroInventario, number>
  total: number
  orden: OrdenInventario
  onOrden: (valor: OrdenInventario) => void
  accion?: ReactNode
}) {
  // Sólo se ofrece un estado si tiene al menos un equipo: la barra es también
  // el resumen de la flota, y una categoría en cero es ruido, no un filtro útil.
  const opciones: { valor: EstadoFiltro; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: `Todos ${total}` },
    ...CATEGORIAS.filter((c) => conteos[c] > 0).map((c) => ({
      valor: c as EstadoFiltro,
      etiqueta: `${ETIQUETA_FILTRO[c]} ${conteos[c]}`,
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <CampoBusqueda
          valor={texto}
          onCambiar={onTexto}
          placeholder="Buscar por nombre o ubicación…"
          className="min-w-50 flex-1"
        />
        <div className="w-44 shrink-0">
          <Select
            id="inventario-orden"
            etiqueta="Ordenar por"
            etiquetaOculta
            value={orden}
            onChange={(e) => onOrden(e.target.value as OrdenInventario)}
          >
            {Object.entries(ETIQUETA_ORDEN).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Select>
        </div>
        {accion}
      </div>

      {/* Sin equipos no hay nada que resumir: la barra de estado desaparece
          entera en vez de mostrar "Todos 0". */}
      {total > 0 && (
        <Segmentado etiqueta="Filtrar por estado" valor={estado} opciones={opciones} onCambiar={onEstado} />
      )}
    </div>
  )
}
