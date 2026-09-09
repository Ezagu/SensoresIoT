import { useMemo, useState } from 'react'
import { IconoMas } from '@/components/layout/iconos'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { useAhora } from '@/hooks/usarAhora'
import { estadoDispositivo, TIC_RELOJ_MS } from '@/utils/tiempo'
import { BarraInventario } from './inventario/BarraInventario'
import { FilaEquipo } from './inventario/FilaEquipo'
import {
  contarPorEstado,
  filtrarDispositivos,
  ordenarDispositivos,
  type FiltroInventario,
  type OrdenInventario,
} from './inventario'
import { useInventario } from './usarInventario'
import type { DispositivoInventario } from '@/tipos'

/* Referencia estable: un literal vacío por render recalcularía los tres useMemo
   de abajo en cada tic del reloj. */
const SIN_DISPOSITIVOS: DispositivoInventario[] = []

function EsqueletoFila() {
  return (
    <div className="flex flex-col gap-2.5 p-3.5 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4.5 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-40" />
    </div>
  )
}

export function Dispositivos() {
  const { datos: dispositivos, cargando, refrescando, error, refrescar, cadenciaSeg } = useInventario()
  // Mismo criterio que el Panel: el tic del reloj nunca es más lento que el
  // poll del equipo más rápido de la cartera.
  const ahora = useAhora(
    cadenciaSeg !== undefined ? Math.min(TIC_RELOJ_MS, cadenciaSeg * 1000) : TIC_RELOJ_MS,
  )

  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<FiltroInventario | 'todos'>('todos')
  const [orden, setOrden] = useState<OrdenInventario>('nombre')

  const lista = dispositivos ?? SIN_DISPOSITIVOS
  const conteos = useMemo(() => contarPorEstado(lista, ahora), [lista, ahora])

  const filtrados = useMemo(
    () => filtrarDispositivos(lista, { texto, estado: estado === 'todos' ? null : estado, ahora }),
    [lista, texto, estado, ahora],
  )
  const ordenados = useMemo(() => ordenarDispositivos(filtrados, orden, ahora), [filtrados, orden, ahora])

  const hayFiltrosActivos = texto !== '' || estado !== 'todos'

  function limpiarFiltros() {
    setTexto('')
    setEstado('todos')
  }

  return (
    <div className="flex flex-col gap-4">
      {!cargando && lista.length > 0 && (
        <BarraInventario
          texto={texto}
          onTexto={setTexto}
          estado={estado}
          onEstado={setEstado}
          conteos={conteos}
          total={lista.length}
          orden={orden}
          onOrden={setOrden}
          accion={
            <BotonLink to="/vincular" variante="fantasma" className="ml-auto">
              <IconoMas className="size-4" />
              Vincular equipo
            </BotonLink>
          }
        />
      )}

      {/* Un fallo de poll con datos ya en pantalla es un aviso al costado, no
          un reemplazo: la última foto buena sigue siendo útil. */}
      {error && dispositivos && <TextoError>No pudimos actualizar: {error}</TextoError>}

      {cargando ? (
        <Card className="flex flex-col divide-y divide-border">
          <EsqueletoFila />
          <EsqueletoFila />
          <EsqueletoFila />
        </Card>
      ) : error && !dispositivos ? (
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
      ) : lista.length === 0 ? (
        <Card>
          <Vacio
            titulo="Todavía no tenés dispositivos"
            detalle="Vinculá tu primer dispositivo con el código impreso en su base y empezá a administrarlo acá."
            accion={
              <BotonLink to="/vincular">
                <IconoMas className="size-4" />
                Vincular dispositivo
              </BotonLink>
            }
          />
        </Card>
      ) : ordenados.length === 0 ? (
        <Card>
          <Vacio
            titulo={texto ? `Ningún equipo coincide con «${texto}»` : 'Ningún equipo coincide con este filtro'}
            detalle="Probá con otro nombre o ubicación, o sacá el filtro de estado."
            accion={
              hayFiltrosActivos ? (
                <Boton variante="sutil" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Boton>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className={refrescando ? 'opacity-60' : ''}>
          <ul className="flex flex-col divide-y divide-border">
            {ordenados.map((d) => (
              <FilaEquipo
                key={d.id}
                dispositivo={d}
                estado={estadoDispositivo(d.last_seen_at, d.intervalo_efectivo_seg, ahora)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
