import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ContextoRanuras, ContextoRastro, MARCA, type Miga } from '@/hooks/usarCabecera'
import { HaceCuanto } from '@/components/ui/HaceCuanto'
import { Logo } from './Logo'
import { IconoAlerta, IconoMas } from './iconos'
import { FilasEquipos, FilaTodos, useCartera } from './ListaEquipos'
import { MenuCuenta } from './MenuCuenta'
import { SelectorEquipos } from './SelectorEquipos'

/* La ruta entera, hoja incluida: es lo que dice dónde estás y no sólo de dónde
   venís. La hoja no es enlace —ya estás ahí— y va en tinta plena. */
function Migas({ items }: { items: Miga[] }) {
  return (
    <nav aria-label="Ruta" className="flex min-w-0 items-center gap-2.5 text-body text-text-muted">
      {items.map((m, i) => (
        <Fragment key={`${m.etiqueta}-${i}`}>
          {i > 0 && (
            <span aria-hidden="true" className="text-text-faint">
              /
            </span>
          )}
          {m.a ? (
            <Link to={m.a} className="truncate transition-colors duration-130 hover:text-text">
              {m.etiqueta}
            </Link>
          ) : (
            <span aria-current="page" className="truncate font-medium text-text">
              {m.etiqueta}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

/* La barra lateral es la lista de equipos y nada más: las secciones de la
   cuenta viven en la barra superior (avisos) y en el menú del avatar. */
function BarraEquipos() {
  const { filas, atencion, cargando, actualizadoAt } = useCartera()

  return (
    <aside className="sticky top-0 hidden h-screen w-72 flex-col overflow-y-auto overscroll-contain border-r border-border bg-sidebar px-3.5 py-4.5 lg:flex">
      <Link to="/" className="flex h-10 shrink-0 items-center px-2.5">
        <Logo />
      </Link>

      <nav aria-label="Equipos" className="mt-4.5 flex flex-col">
        <FilaTodos atencion={atencion} variante="barra" />

        <div className="mt-5.5 mb-1.5 flex items-center justify-between pr-1 pl-2.5">
          <span className="micro">Equipos · {filas.length}</span>
          <Link
            to="/vincular"
            className="inline-flex h-7.5 items-center gap-1.5 rounded-tile border border-border-control px-2.5 text-note-lg font-medium text-text transition-colors duration-130 hover:border-accent-border hover:text-accent"
          >
            <IconoMas className="size-3.5" />
            Vincular
          </Link>
        </div>

        <FilasEquipos filas={filas} cargando={cargando} variante="barra" />
      </nav>

      {actualizadoAt && (
        <p className="mt-auto border-t border-border px-2.5 pt-3 text-note text-text-faint">
          Actualizado <HaceCuanto iso={actualizadoAt} />
        </p>
      )}
    </aside>
  )
}

/* Mismo número que "N requieren atención": lo que hay para mirar en el registro
   es lo que tiene a esos equipos en rojo. */
function EnlaceAvisos() {
  const { atencion } = useCartera()
  const etiqueta =
    atencion > 0
      ? `Avisos, ${atencion} ${atencion === 1 ? 'equipo requiere' : 'equipos requieren'} atención`
      : 'Avisos'

  return (
    <NavLink
      to="/avisos"
      aria-label={etiqueta}
      className={({ isActive }) =>
        `relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-group px-2.5 text-body transition-colors duration-130 hover:bg-border hover:text-text lg:h-9 lg:px-3 ${
          isActive ? 'text-text' : 'text-text-muted'
        }`
      }
    >
      <IconoAlerta className="size-4 shrink-0" />
      <span className="hidden lg:inline">Avisos</span>
      {atencion > 0 && (
        <>
          <span
            aria-hidden="true"
            className="num hidden h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger-mark px-1.25 text-tag font-bold text-bg md:inline-flex"
          >
            {atencion}
          </span>
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-2.5 size-1.75 rounded-chip bg-danger-mark md:hidden"
          />
        </>
      )}
    </NavLink>
  )
}

/* `sinTitulo`: la pantalla pone su propio h1 (el panel abre con la frase de
   estado, no con un título). */
export function Layout({ titulo, sinTitulo = false }: { titulo: string; sinTitulo?: boolean }) {
  /* La pantalla puede afinar la cabecera: la ruta hasta ella y su propio título
     (el nombre del equipo, no "Dispositivo"). */
  const [migas, setMigas] = useState<Miga[] | null>(null)
  const encabezado = migas?.at(-1)?.etiqueta ?? titulo
  const ruta = migas ?? [{ etiqueta: titulo }]

  useEffect(() => {
    document.title = `${encabezado} · ${MARCA}`
  }, [encabezado])

  /* Por callback ref y no useRef: el portal de la pantalla necesita que un
     cambio de nodo dispare un render, y una ref no lo hace. */
  const [nodoMeta, setNodoMeta] = useState<HTMLElement | null>(null)
  const [nodoAcciones, setNodoAcciones] = useState<HTMLElement | null>(null)
  const ranuras = useMemo(
    () => ({ meta: nodoMeta, acciones: nodoAcciones }),
    [nodoMeta, nodoAcciones],
  )

  return (
    <>
      <a
        href="#contenido"
        className="fixed top-2 left-2 z-100 -translate-y-16 focus-visible:translate-y-0 rounded-control bg-accent-strong px-4 py-2 text-label-lg font-semibold text-accent-ink transition-transform duration-150"
      >
        Saltar al contenido
      </a>

      <div className="min-h-full lg:flex">
        <BarraEquipos />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-bg px-4 md:px-7 lg:h-15 lg:px-12">
            <Link to="/" className="shrink-0 lg:hidden">
              <Logo />
            </Link>
            <div className="ml-3 hidden min-w-0 md:block lg:hidden">
              <SelectorEquipos compacto />
            </div>
            <div className="hidden min-w-0 lg:block">
              <Migas items={ruta} />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <EnlaceAvisos />
              <MenuCuenta />
            </div>
          </header>

          <div className="px-4 pt-3 md:hidden">
            <SelectorEquipos />
          </div>

          <main
            id="contenido"
            tabIndex={-1}
            className="w-full max-w-288 px-4 pt-6 pb-16 outline-none md:px-7 md:pt-8 lg:px-16 lg:pt-12"
          >
            <div
              className={`mb-8 flex flex-wrap items-end gap-x-6 gap-y-3 ${sinTitulo ? 'hidden' : ''}`}
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <h1 className="text-page">{encabezado}</h1>
                <div
                  ref={setNodoMeta}
                  className="flex min-w-0 flex-wrap items-baseline gap-2 text-label-lg text-text-muted empty:hidden"
                />
              </div>
              <div ref={setNodoAcciones} className="ml-auto flex items-center gap-2 empty:hidden" />
            </div>

            <ContextoRastro.Provider value={setMigas}>
              <ContextoRanuras.Provider value={ranuras}>
                <Outlet />
              </ContextoRanuras.Provider>
            </ContextoRastro.Provider>
          </main>
        </div>
      </div>
    </>
  )
}
