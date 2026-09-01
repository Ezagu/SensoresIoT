import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  IconoAjustes,
  IconoAlerta,
  IconoCerrar,
  IconoCuenta,
  IconoEquipo,
  IconoMenu,
  IconoPanel,
  IconoPlan,
} from './iconos'

const ESCRITORIO = '(min-width: 1024px)'

const NAV = [
  { a: '/', etiqueta: 'Panel', Icono: IconoPanel, grupo: 'Monitoreo' },
  { a: '/equipos', etiqueta: 'Equipos', Icono: IconoEquipo, grupo: 'Monitoreo' },
  { a: '/alertas', etiqueta: 'Alertas', Icono: IconoAlerta, grupo: 'Monitoreo' },
  { a: '/plan', etiqueta: 'Plan', Icono: IconoPlan, grupo: 'Cuenta' },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes, grupo: 'Cuenta' },
]

const NAV_INFERIOR = [
  { a: '/', etiqueta: 'Panel', Icono: IconoPanel },
  { a: '/equipos', etiqueta: 'Equipos', Icono: IconoEquipo },
  { a: '/alertas', etiqueta: 'Alertas', Icono: IconoAlerta },
  { a: '/ajustes', etiqueta: 'Cuenta', Icono: IconoCuenta },
]

export function Layout({ titulo }: { titulo: string }) {
  const [abierto, setAbierto] = useState(false)
  const [esEscritorio, setEsEscritorio] = useState(() => window.matchMedia(ESCRITORIO).matches)
  const trigger = useRef<HTMLButtonElement>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  useEffect(() => {
    const mq = window.matchMedia(ESCRITORIO)
    const alCambiar = () => {
      setEsEscritorio(mq.matches)
      if (mq.matches) setAbierto(false)
    }
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  // Navegar cierra el drawer: si no, queda tapando la pantalla a la que fuiste
  useEffect(() => setAbierto(false), [location.pathname])

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
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

  /* Bajo 1024px la sidebar es un overlay: cerrada, sus botones seguirían siendo
     focusables fuera de pantalla; abierta, el fondo seguiría siendo tabulable.
     `inert` apaga el lado que no corresponde en cada estado. */
  const overlay = !esEscritorio
  const sidebarInerte = overlay && !abierto
  const fondoInerte = overlay && abierto

  return (
    <>
      <a
        href="#contenido"
        className="fixed left-2 z-100 -top-12 focus-visible:top-2 rounded-[8px] bg-accent-strong px-4 py-2 text-[12.5px] font-semibold text-accent-ink transition-[top] duration-150"
      >
        Saltar al contenido
      </a>

      <div
        onClick={() => setAbierto(false)}
        className={`fixed inset-0 z-40 bg-black/55 transition-opacity duration-200 lg:hidden ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div className="min-h-full lg:grid lg:grid-cols-[232px_1fr]">
        <aside
          inert={sidebarInerte}
          className={`fixed top-0 left-0 z-50 flex h-screen w-[250px] flex-col gap-6 overflow-y-auto overscroll-contain border-r border-border bg-sidebar p-5 px-3.5 transition-transform duration-200 lg:sticky lg:w-auto lg:translate-x-0 ${
            abierto ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            ref={cerrar}
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="-mt-1.5 -mr-1 -mb-3 flex size-[30px] items-center justify-center self-end rounded-[8px] border border-border text-text-muted lg:hidden"
          >
            <IconoCerrar className="size-4" />
          </button>

          <div className="flex items-center gap-2.5 px-2">
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-accent-strong">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-4"
              >
                <path d="M3 17l5-6 4 4 5-8 4 5" />
              </svg>
            </span>
            <span className="font-display text-base font-bold tracking-tight text-text">Bitácora</span>
          </div>

          <nav className="flex flex-col gap-0.5">
            {['Monitoreo', 'Cuenta'].map((grupo) => (
              <div key={grupo} className="flex flex-col gap-0.5">
                <span className="px-3 pt-3 pb-1.5 text-[10.5px] font-medium tracking-[0.08em] text-text-faint uppercase">
                  {grupo}
                </span>
                {NAV.filter((i) => i.grupo === grupo).map(({ a, etiqueta, Icono }) => (
                  <NavLink
                    key={a}
                    to={a}
                    end={a === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-accent-soft text-text'
                          : 'text-text-muted hover:bg-surface-2 hover:text-text'
                      }`
                    }
                  >
                    <Icono className="size-[17px] shrink-0" />
                    {etiqueta}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-auto flex items-center gap-2.5 border-t border-border px-2 py-2.5">
            <div className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#4C7DFF] to-[#8B5CF6] font-display text-[12.5px] font-bold text-white">
              ?
            </div>
            <div className="flex min-w-0 flex-col">
              <strong className="truncate text-[12.5px] font-medium text-text">Mi cuenta</strong>
              <small className="text-[11px] text-text-faint">Sesión iniciada</small>
            </div>
          </div>
        </aside>

        <main id="contenido" tabIndex={-1} inert={fondoInerte} className="min-w-0">
          <div className="sticky top-0 z-5 flex min-h-[52px] items-center gap-2.5 border-b border-border bg-bg px-4 md:min-h-14 md:gap-3.5 md:px-5.5">
            <button
              ref={trigger}
              onClick={() => setAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={abierto}
              className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-text-muted lg:hidden"
            >
              <IconoMenu className="size-[17px]" />
            </button>
            <h1 className="text-[17px] md:text-[19px]">{titulo}</h1>
          </div>

          <div className="mx-auto w-full max-w-[1360px] px-4 pt-4.5 pb-24 md:px-5.5 md:pt-5.5 lg:pb-16">
            <Outlet />
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
              `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10.5px] font-medium ${
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
