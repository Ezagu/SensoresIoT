import { useMemo, useState } from 'react'
import { IconoMas } from '@/components/layout/iconos'
import { Banner } from '@/components/ui/Banner'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { Vacio } from '@/components/ui/Vacio'
import { estadoDispositivo, TIC_RELOJ_MS } from '@/utils/tiempo'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { useAhora } from '@/hooks/usarAhora'
import { BarraInventario } from './inventario/BarraInventario'
import { CabeceraColumnas, FilaEquipo } from './inventario/FilaEquipo'
import {
  contarPorEstado,
  filtrarDispositivos,
  ordenarDispositivos,
  sinCobertura,
  type FiltroInventario,
  type OrdenInventario,
} from './inventario'
import { useInventario, type EquipoInventario } from './usarInventario'

/* Referencia estable: un literal vacío por render recalcularía los tres useMemo
   de abajo en cada tic del reloj. */
const SIN_DISPOSITIVOS: EquipoInventario[] = []

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
  const { datos: dispositivos, cargando, refrescando, error, refrescar } = useInventario()

  // Si el equipo está caído lo dice el backend, pero "con retraso" es contra el
  // reloj: sin un tic, un equipo que se atrasa entre dos polls no se movería de
  // categoría. Uno solo por render, compartido por conteo, filtro y orden.
  const ahora = useAhora(TIC_RELOJ_MS)

  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<FiltroInventario | 'todos'>('todos')
  const [orden, setOrden] = useState<OrdenInventario>('nombre')

  const lista = dispositivos ?? SIN_DISPOSITIVOS
  const conteos = useMemo(() => contarPorEstado(lista, ahora), [lista, ahora])

  const filtrados = useMemo(
    () => filtrarDispositivos(lista, { texto, estado: estado === 'todos' ? null : estado, ahora }),
    [lista, texto, estado, ahora],
  )
  const ordenados = useMemo(
    () => ordenarDispositivos(filtrados, orden, ahora),
    [filtrados, orden, ahora],
  )

  const hayFiltrosActivos = texto !== '' || estado !== 'todos'

  /* Sólo si el endpoint mandó el dato: con los campos sin enriquecer, "ninguno
     tiene reglas" sería una afirmación falsa, no un vacío. */
  const descubiertos = useMemo(() => (lista[0]?.enriquecido ? sinCobertura(lista) : []), [lista])

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

      {/* La pregunta que el panel no puede contestar: no es qué está fallando,
          es qué no está vigilado. Informativo y no advertencia — no hay ninguna
          falla, falta una decisión. */}
      {descubiertos.length > 0 && (
        <Banner
          tono="info"
          titulo={
            descubiertos.length === 1
              ? `${nombreDeDispositivo(descubiertos[0].id, descubiertos[0].nombre)} no tiene ninguna regla de alerta`
              : `${descubiertos.length} equipos sin ninguna regla de alerta`
          }
          acciones={
            descubiertos.length === 1 ? (
              <BotonLink variante="sutil" to={`/dispositivos/${descubiertos[0].id}`}>
                Ver equipo
              </BotonLink>
            ) : orden !== 'cobertura' ? (
              <Boton variante="sutil" onClick={() => setOrden('cobertura')}>
                Ver cuáles
              </Boton>
            ) : undefined
          }
        >
          Miden y guardan igual, pero no te van a avisar si un valor se va de rango. Las reglas se
          crean en el detalle de cada equipo.
        </Banner>
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
            <CabeceraColumnas />
            {ordenados.map((d) => (
              <FilaEquipo
                key={d.id}
                dispositivo={d}
                estado={estadoDispositivo(d, ahora)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
