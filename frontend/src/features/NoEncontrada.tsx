import { Link, useLocation } from 'react-router-dom'
import { BotonLink } from '@/components/ui/Boton'
import { IconoFlecha } from '@/components/layout/iconos'
import { Logo } from '@/components/layout/Logo'
import { useSesion } from '@/features/auth/sesion'

/* La dirección se parte en lo que existe (el primer segmento, en línea firme
   hasta una página) y lo que no (el resto, punteado hasta una página vacía).
   Sin metáforas de señal ni de batería: acá lo que falla es la dirección. */
function Dibujo({ existe, resto }: { existe: string; resto: string }) {
  return (
    <svg
      viewBox="0 0 480 330"
      className="w-full max-w-120 fill-none text-text"
      role="img"
      aria-label={`${existe} lleva a una página que existe; ${existe}${resto} lleva a una página vacía que no existe`}
    >
      <g strokeLinecap="round" strokeLinejoin="round" className="stroke-current">
        <rect
          x=".75"
          y=".75"
          width="478.5"
          height="46"
          rx="8"
          className="fill-elevated"
          strokeOpacity=".35"
        />
        <path d="M18 18l-5 5.5 5 5.5M30 18l5 5.5-5 5.5" strokeOpacity=".35" strokeWidth="1.4" />
        <path d="M72 47v103" strokeOpacity=".4" strokeWidth="1.4" />
        <path
          d="M195 47v38c0 12 8 20 20 20h95c12 0 20 8 20 20v25"
          className="stroke-accent-strong"
          strokeWidth="1.6"
          strokeDasharray="3 7"
        />
        <path
          d="M22 150h82l18 18v142H22Z"
          className="fill-elevated"
          strokeOpacity=".5"
          strokeWidth="1.3"
        />
        <path d="M104 150v18h18" strokeOpacity=".5" strokeWidth="1.3" />
        <path
          d="M40 186h56M40 204h64M40 222h48M40 250h64M40 268h40"
          strokeOpacity=".3"
          strokeWidth="1.3"
        />
        <path
          d="M270 150h102l18 18v142H270Z"
          className="stroke-accent-strong"
          strokeOpacity=".8"
          strokeWidth="1.4"
          strokeDasharray="5 6"
        />
        <path
          d="M372 150v18h18"
          className="stroke-accent-strong"
          strokeOpacity=".8"
          strokeWidth="1.4"
          strokeDasharray="5 6"
        />
      </g>
      <text x="52" y="29" fontSize={14} className="font-mono">
        <tspan className="fill-current" fillOpacity=".55">
          {existe}
        </tspan>
        <tspan className="fill-accent">
          {resto.length > 34 ? `${resto.slice(0, 33)}…` : resto}
        </tspan>
      </text>
      <text
        x="330"
        y="240"
        textAnchor="middle"
        fontSize={26}
        fontWeight={500}
        className="fill-accent font-mono"
      >
        ?
      </text>
    </svg>
  )
}

export function NoEncontrada() {
  const { pathname } = useLocation()
  const { estado } = useSesion()
  const segmento = pathname.split('/').filter(Boolean)[0] ?? ''
  const existe = `/${segmento}${pathname.length > segmento.length + 1 ? '/' : ''}`
  const resto = pathname.slice(existe.length)
  const destino =
    estado === 'dentro'
      ? { a: '/', etiqueta: 'Volver al panel' }
      : { a: '/login', etiqueta: 'Ir a ingresar' }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-5 py-4 md:px-12 md:py-5">
        <Link to="/" aria-label="Bitácora, inicio">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-250 flex-1 items-center gap-10 px-5 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16 md:px-12">
        <div className="order-2 md:order-1">
          <p className="num text-display leading-none tracking-tighter md:text-[128px]">404</p>
          <h1 className="mt-5 text-page md:text-hero md:leading-tight md:tracking-tight">
            Esta página no existe.
          </h1>
          <p className="mt-3 text-heading text-text-muted">
            La dirección que buscaste no se encontró.
          </p>
          <p className="mt-2 font-mono text-note-lg break-all text-text-faint">
            No encontramos <span className="text-text">{pathname}</span>
          </p>
          <BotonLink to={destino.a} className="mt-7 w-full md:w-auto">
            {destino.etiqueta}
            <IconoFlecha className="size-3.5" />
          </BotonLink>
        </div>
        <div className="order-1 md:order-2">
          <Dibujo existe={existe} resto={resto} />
        </div>
      </main>
    </div>
  )
}
