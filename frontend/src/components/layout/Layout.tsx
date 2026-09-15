import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '@/features/auth/sesion'
import { ContextoTitulo, MARCA } from '@/hooks/usarTitulo'
import { useMediaQuery } from '@/hooks/usarMedios'
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

const NAV = [
  { a: '/', etiqueta: 'Panel', Icono: IconoPanel, grupo: 'Monitoreo' },
  { a: '/dispositivos', etiqueta: 'Dispositivos', Icono: IconoDispositivo, grupo: 'Monitoreo' },
  { a: '/alertas', etiqueta: 'Alertas', Icono: IconoAlerta, grupo: 'Monitoreo' },
  { a: '/plan', etiqueta: 'Plan', Icono: IconoPlan, grupo: 'Cuenta' },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes, grupo: 'Cuenta' },
]

const NAV_INFERIOR = [
  { a: '/', etiqueta: 'Panel', Icono: IconoPanel },
  { a: '/dispositivos', etiqueta: 'Dispositivos', Icono: IconoDispositivo },
  { a: '/alertas', etiqueta: 'Alertas', Icono: IconoAlerta },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes },
]

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

  /* La pantalla puede afinarlo (el nombre del equipo, no "Dispositivos"). */
  const [especifico, setEspecifico] = useState<string | null>(null)
  useEffect(() => {
    document.title = `${especifico ?? titulo} · ${MARCA}`
  }, [especifico, titulo])

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

      <div className="min-h-full lg:grid lg:grid-cols-[232px_1fr]">
        <aside
          inert={sidebarInerte}
          className={`fixed top-0 left-0 z-50 flex h-screen w-62.5 flex-col gap-6 overflow-y-auto overscroll-contain border-r border-border bg-sidebar p-5 px-3.5 transition-transform duration-200 lg:sticky lg:w-auto lg:translate-x-0 ${
            abierto ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            ref={cerrar}
            onClick={() => setAbiertoEn(null)}
            aria-label="Cerrar menú"
            className="-mt-1.5 -mr-1 -mb-3 flex size-7.5 items-center justify-center self-end rounded-control border border-border text-text-muted lg:hidden cursor-pointer"
          >
            <IconoCerrar className="size-4" />
          </button>

          <div className="px-2">
            <Logo />
          </div>

          <nav className="flex flex-col gap-0.5">
            {['Monitoreo', 'Cuenta'].map((grupo) => (
              <div key={grupo} className="flex flex-col gap-0.5">
                <span className="px-3 pt-3 pb-1.5 text-tag font-medium tracking-[0.08em] text-text-faint uppercase">
                  {grupo}
                </span>
                {NAV.filter((i) => i.grupo === grupo).map(({ a, etiqueta, Icono }) => (
                  <NavLink
                    key={a}
                    to={a}
                    end={a === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-control px-3 py-2 text-body font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-accent-soft text-text'
                          : 'text-text-muted hover:bg-surface-2 hover:text-text'
                      }`
                    }
                  >
                    <Icono className="size-4.25 shrink-0" />
                    {etiqueta}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-border pt-2.5">
            {/* Sin estado activo propio: lleva a /ajustes, que ya se marca en el
                nav de arriba, y dos bloques encendidos por la misma ruta se leen
                como dos destinos distintos. */}
            <NavLink
              to="/ajustes"
              className="flex items-center gap-2.5 rounded-control px-2 py-2 transition-colors duration-150 hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className="flex size-7.5 shrink-0 items-center justify-center rounded-control border border-border bg-surface-2 font-display text-label-lg font-bold text-text"
              >
                {iniciales(sesion?.nombre)}
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="truncate text-label-lg font-medium text-text">
                  {sesion?.nombre ?? 'Mi cuenta'}
                </strong>
                {/* El espacio duro reserva el renglón mientras carga el plan,
                    para que el bloque no crezca después de montar. */}
                <small className={`truncate text-note  ${plan?.plan.id !== "free" ? "text-accent" : "text-text-faint"}`}>
                {plan ? `Plan ${plan.plan.nombre}` : ' '}
                </small>
              </span>
            </NavLink>
          </div>
        </aside>

        <main id="contenido" tabIndex={-1} inert={fondoInerte} className="min-w-0">
          <div className="sticky top-0 z-5 flex min-h-13 items-center gap-2.5 border-b border-border bg-bg px-4 md:min-h-14 md:gap-3.5 md:px-5.5">
            <button
              ref={trigger}
              onClick={() => setAbiertoEn(location.pathname)}
              aria-label="Abrir menú"
              aria-expanded={abierto}
              className="flex size-9 shrink-0 items-center justify-center rounded-group border border-border bg-surface text-text-muted lg:hidden cursor-pointer"
            >
              <IconoMenu className="size-4.25" />
            </button>
            <h1 className="text-page md:text-page-lg">{titulo}</h1>
          </div>

          <div className="mx-auto w-full max-w-340 px-4 pt-4.5 pb-24 md:px-5.5 md:pt-5.5 lg:pb-16">
            <ContextoTitulo.Provider value={setEspecifico}>
              <Outlet />
            </ContextoTitulo.Provider>
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
