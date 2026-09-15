import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '@/features/auth/sesion'
import {
  ContextoRanuras,
  ContextoRastro,
  MARCA,
  type Miga,
} from '@/hooks/usarCabecera'
import { useMediaQuery } from '@/hooks/usarMedios'
import { BotonIcono } from '@/components/ui/BotonIcono'
import { Logo } from './Logo'
import {
  IconoAjustes,
  IconoAlerta,
  IconoCerrar,
  IconoDispositivo,
  IconoMenu,
  IconoPanel,
  IconoPlan,
} from './iconos'

const ESCRITORIO = '(min-width: 1024px)'

/* Iniciales para el avatar: dos como máximo, y el fallback es una interrogación
   porque el nombre puede no haber llegado todavía. */
export function iniciales(nombre?: string) {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return partes
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

/* El primer grupo no lleva encabezado: es la navegación primaria y no necesita
   que la presenten. "Cuenta" sí, porque separa dos cosas distintas. */
const NAV: { etiqueta?: string; items: { a: string; etiqueta: string; Icono: typeof IconoPanel }[] }[] = [
  {
    items: [
      { a: '/', etiqueta: 'Panel', Icono: IconoPanel },
      { a: '/dispositivos', etiqueta: 'Dispositivos', Icono: IconoDispositivo },
      { a: '/alertas', etiqueta: 'Avisos', Icono: IconoAlerta },
    ],
  },
  {
    etiqueta: 'Cuenta',
    items: [
      { a: '/plan', etiqueta: 'Plan', Icono: IconoPlan },
      { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes },
    ],
  },
]

const NAV_INFERIOR = [
  { a: '/', etiqueta: 'Panel', Icono: IconoPanel },
  { a: '/dispositivos', etiqueta: 'Dispositivos', Icono: IconoDispositivo },
  { a: '/alertas', etiqueta: 'Avisos', Icono: IconoAlerta },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes },
]

function claseItem({ isActive }: { isActive: boolean }) {
  return `flex h-8 items-center gap-3 rounded-control px-2 text-body transition-colors duration-130 ${
    isActive
      ? 'bg-accent-soft font-medium text-accent'
      : 'text-text-muted hover:bg-surface-2 hover:text-text'
  }`
}

/* La ruta entera, hoja incluida: repite el título de abajo, pero es lo que hace
   que la miga diga dónde estás y no sólo de dónde venís. La hoja no es enlace
   —ya estás ahí— y va en tinta plena. */
function Migas({ items }: { items: Miga[] }) {
  return (
    <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-note-lg text-text-muted">
      {items.map((m, i) => (
        <Fragment key={`${m.etiqueta}-${i}`}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {m.a ? (
            <Link to={m.a} className="truncate transition-colors duration-130 hover:text-text">
              {m.etiqueta}
            </Link>
          ) : (
            <span className="truncate text-text">{m.etiqueta}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

export function Layout({ titulo }: { titulo: string }) {
  const { sesion, plan } = useSesion()
  const location = useLocation()
  const trigger = useRef<HTMLButtonElement>(null)
  const cerrar = useRef<HTMLButtonElement>(null)

  /* Bajo 1024px la sidebar es un overlay; arriba es una columna fija. */
  const overlay = !useMediaQuery(ESCRITORIO)

  /* "abierto" se deriva de la ruta en que se abrió: navegar o pasar a escritorio
     lo cierran solos, sin un efecto. */
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null)
  const abierto = overlay && abiertoEn === location.pathname

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbiertoEn(null)
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])

  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [abierto])

  useEffect(() => {
    if (abierto) cerrar.current?.focus()
    else trigger.current?.focus({ preventScroll: true })
  }, [abierto])

  /* `inert` apaga el lado que no corresponde: la sidebar fuera de pantalla, o el
     fondo con el drawer abierto. */
  const sidebarInerte = overlay && !abierto
  const fondoInerte = overlay && abierto

  /* La pantalla puede afinar la cabecera: la ruta hasta ella y su propio título
     (el nombre del equipo, no "Dispositivos"). */
  const [migas, setMigas] = useState<Miga[] | null>(null)
  const encabezado = migas?.at(-1)?.etiqueta ?? titulo
  const ruta = migas ?? []

  useEffect(() => {
    document.title = `${encabezado} · ${MARCA}`
  }, [encabezado])

  /* Por callback ref y no useRef: el portal de la pantalla necesita que un
     cambio de nodo dispare un render, y una ref no lo hace. */
  const [nodoMeta, setNodoMeta] = useState<HTMLElement | null>(null)
  const [nodoAcciones, setNodoAcciones] = useState<HTMLElement | null>(null)
  const ranuras = useMemo(() => ({ meta: nodoMeta, acciones: nodoAcciones }), [nodoMeta, nodoAcciones])

  return (
    <>
      <a
        href="#contenido"
        className="fixed top-2 left-2 z-100 -translate-y-16 focus-visible:translate-y-0 rounded-control bg-accent-strong px-4 py-2 text-label-lg font-semibold text-accent-ink transition-transform duration-150"
      >
        Saltar al contenido
      </a>

      <div
        onClick={() => setAbiertoEn(null)}
        className={`fixed inset-0 z-40 bg-overlay transition-opacity duration-200 lg:hidden ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div className="min-h-full lg:grid lg:grid-cols-[248px_1fr]">
        <aside
          inert={sidebarInerte}
          className={`fixed top-0 left-0 z-50 flex h-screen w-62 flex-col gap-6 overflow-y-auto overscroll-contain border-r border-border bg-sidebar px-4 pt-3.5 pb-5 transition-transform duration-200 lg:sticky lg:w-auto lg:translate-x-0 ${
            abierto ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            ref={cerrar}
            onClick={() => setAbiertoEn(null)}
            aria-label="Cerrar menú"
            className="-mt-1.5 -mr-1 -mb-3 flex size-7.5 cursor-pointer items-center justify-center self-end rounded-control border border-border-control text-text-muted lg:hidden"
          >
            <IconoCerrar className="size-4" />
          </button>

          {/* El padding superior es menor que el resto para que el wordmark caiga
              en la misma línea óptica que el título de la cabecera. */}
          <div className="px-2">
            <Logo />
          </div>

          <nav aria-label="Secciones" className="flex flex-col gap-6">
            {NAV.map((grupo, i) => (
              <div key={grupo.etiqueta ?? i} className="flex flex-col gap-0.5">
                {grupo.etiqueta && (
                  <span className="px-2 pb-1.5 text-tag font-semibold tracking-micro text-text-faint uppercase">
                    {grupo.etiqueta}
                  </span>
                )}
                {grupo.items.map(({ a, etiqueta, Icono }) => (
                  <NavLink key={a} to={a} end={a === '/'} className={claseItem}>
                    <Icono className="size-4 shrink-0" />
                    {etiqueta}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
            {/* Sin estado activo propio: lleva a /ajustes, que ya se marca en el
                nav de arriba, y dos bloques encendidos por la misma ruta se leen
                como dos destinos distintos. */}
            <NavLink
              to="/ajustes"
              className="flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors duration-130 hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className="flex size-7.5 shrink-0 items-center justify-center rounded-chip border border-border bg-surface-2 text-tag font-semibold text-text"
              >
                {iniciales(sesion?.nombre)}
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="truncate text-label-lg font-medium text-text">
                  {sesion?.nombre ?? 'Mi cuenta'}
                </strong>
                {/* El espacio duro reserva el renglón mientras carga el plan,
                    para que el bloque no crezca después de montar. */}
                <small
                  className={`truncate text-note ${plan?.plan.id !== 'free' ? 'text-accent' : 'text-text-faint'}`}
                >
                  {plan ? `Plan ${plan.plan.nombre}` : ' '}
                </small>
              </span>
            </NavLink>
          </div>
        </aside>

        <main id="contenido" tabIndex={-1} inert={fondoInerte} className="min-w-0">
          {/* El marco llega de borde a borde; lo de adentro comparte columna con
              el contenido, así el título cae sobre la misma línea vertical. */}
          <header className="sticky top-0 z-5 h-18 border-b border-border bg-surface px-4 md:px-5 lg:px-8">
            <div className="m-auto flex h-full w-full max-w-7xl items-center gap-3 md:gap-4">
              <BotonIcono
                ref={trigger}
                etiqueta="Abrir menú"
                variante="marco"
                aria-expanded={abierto}
                onClick={() => setAbiertoEn(location.pathname)}
                className="lg:hidden"
              >
                <IconoMenu className="size-4.25" />
              </BotonIcono>

              <div className="flex min-w-0 flex-col">
                {ruta.length > 0 && <Migas items={ruta} />}
                {/* La frescura comparte renglón y línea de base con el título:
                    es el subtítulo del dato que se está mirando, no un tercer
                    bloque de la barra. */}
                <div className="flex min-w-0 items-baseline gap-2.5">
                  <h1 className="truncate text-page">{encabezado}</h1>
                  <div
                    ref={setNodoMeta}
                    className="hidden min-w-0 items-baseline gap-2 truncate text-note-lg text-text-muted md:flex md:empty:hidden"
                  />
                </div>
              </div>

              <div ref={setNodoAcciones} className="ml-auto flex items-center gap-2 empty:hidden" />
            </div>
          </header>

          <div className="w-full m-auto max-w-7xl px-4 pt-6 pb-24 md:px-5 md:pt-8 lg:px-8 lg:pb-16">
            <ContextoRastro.Provider value={setMigas}>
              <ContextoRanuras.Provider value={ranuras}>
                <Outlet />
              </ContextoRanuras.Provider>
            </ContextoRastro.Provider>
          </div>
        </main>
      </div>

      <nav
        inert={fondoInerte}
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV_INFERIOR.map(({ a, etiqueta, Icono }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-tag font-medium ${
                isActive ? 'text-accent' : 'text-text-faint'
              }`
            }
          >
            <Icono className="size-5" />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
