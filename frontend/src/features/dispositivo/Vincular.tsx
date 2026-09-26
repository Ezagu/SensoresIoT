import { useCallback, useState, type ReactNode, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { TextoError } from '@/components/ui/TextoError'
import { IconoTilde } from '@/components/layout/iconos'
import { useCarga } from '@/hooks/usarCarga'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { estadoHttp, mensajeDeError } from '@/services/api'
import {
  actualizarDispositivo,
  obtenerEstadoDispositivo,
  vincularDispositivo,
} from '@/services/consultas'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/* Mientras se espera la primera conexión: lo que tarda alguien en cargar su
   WiFi desde el celular, sin martillar el backend. */
const POLL_MS = 5_000

type EstadoPaso = 'hecho' | 'ahora' | 'despues'

function Paso({
  numero,
  estado,
  titulo,
  ultimo = false,
  children,
}: {
  numero: number
  estado: EstadoPaso
  titulo: string
  ultimo?: boolean
  children: ReactNode
}) {
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4.5 pb-9">
      {!ultimo && (
        <span
          aria-hidden="true"
          className="absolute top-8 bottom-0 left-4 w-px bg-border-control"
        />
      )}
      <span
        className={`num relative flex size-8 items-center justify-center rounded-full border text-body ${
          estado === 'ahora'
            ? 'border-transparent bg-accent-strong text-accent-ink'
            : estado === 'hecho'
              ? 'border-accent-border bg-accent-soft text-accent'
              : 'border-border-control bg-bg text-text-faint'
        }`}
      >
        {estado === 'hecho' ? <IconoTilde className="size-3.5" /> : numero}
      </span>
      <div className="min-w-0 pt-1">
        <h2 className={`text-heading-lg ${estado === 'despues' ? 'text-text-muted' : ''}`}>
          {titulo}
        </h2>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  )
}

function Esperando({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div
      role="status"
      className="mt-4 flex items-center gap-4 rounded-group border border-accent-border bg-accent-soft px-5 py-4"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5.5 shrink-0 animate-pulse fill-none stroke-accent-strong"
        strokeWidth={1.6}
        strokeLinecap="round"
      >
        <path d="M3.5 9.5a12 12 0 0 1 17 0" />
        <path d="M6.5 12.8a7.6 7.6 0 0 1 11 0" />
        <path d="M9.6 16a3.4 3.4 0 0 1 4.8 0" />
        <circle cx="12" cy="19" r="1" className="fill-accent-strong" />
      </svg>
      <div>
        <p className="text-body-lg">{titulo}</p>
        <p className="text-note-lg text-text-muted">{detalle}</p>
      </div>
    </div>
  )
}

/* Sigue la vida del equipo recién vinculado: primero que hable, después que
   mande datos. Pollea sólo mientras falta alguna de las dos. */
function useConexion(id: string | null) {
  const [listo, setListo] = useState(false)
  const cargar = useCallback(
    (signal: AbortSignal) => (id ? obtenerEstadoDispositivo(id, signal) : Promise.resolve(null)),
    [id],
  )
  const { datos } = useCarga(cargar, { intervaloMs: id && !listo ? POLL_MS : undefined })
  const midio = !!datos?.last_data_at
  if (midio && !listo) setListo(true)
  return { conecto: !!datos?.last_seen_at, midio }
}

function Ilustracion() {
  return (
    <figure className="m-0 hidden flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-surface p-10 text-text lg:flex">
      <svg
        viewBox="0 0 320 260"
        className="w-80 fill-none"
        role="img"
        aria-label="El código está en la etiqueta de la base del equipo"
      >
        <rect
          x="60"
          y="40"
          width="200"
          height="150"
          rx="16"
          className="fill-elevated stroke-current"
          strokeOpacity=".5"
          strokeWidth="1.2"
        />
        <rect
          x="80"
          y="60"
          width="160"
          height="110"
          rx="8"
          className="fill-surface stroke-current"
          strokeOpacity=".2"
        />
        <path d="M96 150h18M96 156h18M96 162h18" className="stroke-current" strokeOpacity=".3" />
        <circle cx="222" cy="78" r="8" className="fill-accent-strong" opacity=".15" />
        <circle cx="222" cy="78" r="3.5" className="fill-accent-strong" />
        <path d="M150 190v26" className="stroke-current" strokeOpacity=".35" />
        <rect
          x="112"
          y="206"
          width="96"
          height="36"
          rx="4"
          className="fill-bg stroke-accent-strong"
          strokeWidth="1.3"
        />
        <path
          d="M122 218h56M122 227h40"
          className="stroke-accent-strong"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <rect
          x="186"
          y="214"
          width="14"
          height="14"
          rx="1"
          className="stroke-accent-strong"
          strokeWidth="1.2"
        />
        <text
          x="240"
          y="232"
          fontSize={10}
          letterSpacing={1}
          className="fill-current font-mono"
          opacity=".55"
        >
          CÓDIGO
        </text>
      </svg>
      <figcaption className="max-w-64 text-center text-body leading-relaxed text-text-muted">
        El código está en la etiqueta de la base. Si el equipo ya estaba vinculado a otra cuenta,
        pedile a esa persona que te comparta el acceso.
      </figcaption>
    </figure>
  )
}

export function Vincular() {
  const { refrescar } = useDispositivos()
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vinculado, setVinculado] = useState<string | null>(null)
  const { conecto, midio } = useConexion(vinculado)

  async function vincular(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const id = codigo.trim().toLowerCase()
    if (!UUID.test(id)) {
      setError('El código tiene la forma 7f3c9e21-4b1a-… : 36 caracteres, con guiones.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await vincularDispositivo(id)
      if (nombre.trim()) await actualizarDispositivo(id, { nombre: nombre.trim() })
      setVinculado(id)
      refrescar()
    } catch (err) {
      const estado = estadoHttp(err)
      setError(
        estado === 404
          ? 'No encontramos un equipo con ese código. Revisá la etiqueta de la base.'
          : estado === 409
            ? 'Este equipo ya está vinculado a otra cuenta. Pedile a esa persona que te comparta el acceso.'
            : mensajeDeError(err, 'No pudimos vincular el equipo.'),
      )
    } finally {
      setEnviando(false)
    }
  }

  const corto = vinculado ? `${vinculado.slice(0, 8)}-…-${vinculado.slice(-4)}` : ''

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
      <div>
        <h1 className="text-page md:text-hero md:leading-none md:tracking-tight">
          Sumá un equipo.
        </h1>
        <p className="mt-3.5 max-w-100 text-heading-lg leading-relaxed text-text-muted">
          Tres pasos. El primer dato llega a los pocos segundos de conectarlo.
        </p>

        <ol className="mt-10 max-w-128">
          <Paso numero={1} estado={vinculado ? 'hecho' : 'ahora'} titulo="Código del equipo">
            {vinculado ? (
              <p className="flex items-center gap-3">
                <span className="font-mono text-body text-text-muted">{corto}</span>
                {nombre.trim() && <span className="text-body-lg">{nombre.trim()}</span>}
              </p>
            ) : (
              <form onSubmit={vincular} className="flex flex-col gap-4">
                <p className="text-body text-text-muted">
                  Está en la etiqueta de la base del equipo.
                </p>
                <Campo
                  id="vincular-codigo"
                  etiqueta="Código"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="7f3c9e21-4b1a-4c2d-9e8f-0a1b2c3d4e5f"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  required
                />
                <Campo
                  id="vincular-nombre"
                  etiqueta="Nombre (opcional)"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Depósito 3"
                  maxLength={80}
                />
                {error && <TextoError>{error}</TextoError>}
                <Boton type="submit" disabled={enviando} className="self-start">
                  {enviando ? 'Vinculando…' : 'Vincular'}
                </Boton>
              </form>
            )}
          </Paso>

          <Paso
            numero={2}
            estado={!vinculado ? 'despues' : conecto ? 'hecho' : 'ahora'}
            titulo="Conectalo a tu WiFi"
          >
            <p className="text-body leading-relaxed text-text-muted">
              Enchufalo. Desde el celular, conectate a la red{' '}
              <b className="font-semibold text-text">SensoresIoT-Setup</b> y elegí tu WiFi en la
              página que se abre.
            </p>
            {vinculado && !conecto && (
              <Esperando
                titulo="Esperando que el equipo se conecte"
                detalle="Esta página se actualiza sola."
              />
            )}
          </Paso>

          <Paso
            numero={3}
            estado={!conecto ? 'despues' : midio ? 'hecho' : 'ahora'}
            titulo="Primera lectura"
            ultimo
          >
            <p className="text-body leading-relaxed text-text-muted">
              Durante la primera media hora reporta cada 15 segundos, para que veas el gráfico
              moverse enseguida.
            </p>
            {conecto && !midio && (
              <Esperando
                titulo="Conectado. Esperando la primera lectura"
                detalle="Suele tardar unos segundos."
              />
            )}
            {midio && vinculado && (
              <BotonLink to={`/dispositivos/${vinculado}`} className="mt-4">
                Ver equipo
              </BotonLink>
            )}
          </Paso>
        </ol>

        {!midio && (
          <Link
            to={vinculado ? `/dispositivos/${vinculado}` : '/'}
            className="ml-5 inline-flex h-10 items-center text-body-lg font-medium text-text-muted hover:text-text"
          >
            Terminar después
          </Link>
        )}
      </div>

      <Ilustracion />
    </div>
  )
}
