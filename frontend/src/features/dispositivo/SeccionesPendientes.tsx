import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { IconoPin } from '@/components/layout/iconos'

/* Lo que el equipo pidió ver primero: tarjetas grandes con su gráfico de 24 h.
   PENDIENTE: fijar necesita persistencia en el backend; hasta entonces la
   sección se muestra vacía con el aviso. */
export function SeccionFijados() {
  return (
    <section aria-labelledby="titulo-fijados">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="titulo-fijados" className="text-heading-lg">
          Fijados <span className="font-medium text-text-faint">· 0</span>
        </h2>
        <span className="micro">Gráficos: últimas 24 h</span>
      </div>
      <div className="mt-3.5 flex flex-col gap-3 border-y border-border-control py-5">
        <p className="flex flex-wrap items-center gap-1.5 text-body text-text-muted">
          Fijá con <IconoPin className="size-3.5" /> los sensores que querés ver primero: aparecen
          acá con su valor y su gráfico.
        </p>
        <AvisoPendiente>
          fijar sensores todavía no se guarda en el backend. El botón de cada renglón está
          deshabilitado.
        </AvisoPendiente>
      </div>
    </section>
  )
}

export type EstadoBateria = 'descargando' | 'estable' | 'cargando' | 'solar'

const TEXTO_BATERIA: Record<EstadoBateria, string> = {
  descargando: 'Descargando',
  estable: 'Estable',
  cargando: 'Cargando',
  solar: 'Cargando con solar',
}

/* Sólo porcentaje y estado. Debajo de 20 % pasa a ámbar y debajo de 10 % a rojo
   con la acción a tomar; un equipo sin batería no muestra nada. */
export function Bateria({ porcentaje, estado }: { porcentaje: number; estado: EstadoBateria }) {
  const critica = porcentaje < 10
  const baja = porcentaje < 20
  const tono = critica ? 'text-danger' : baja ? 'text-attention' : 'text-text'
  const accion = critica
    ? 'Cambiala o cargala antes de que se apague.'
    : baja
      ? 'Conviene cargarla pronto.'
      : null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span
        aria-hidden="true"
        className={`relative flex h-6 w-12 rounded-tile border-2 border-current p-0.75 after:absolute after:top-1.5 after:-right-1.5 after:h-2 after:w-0.75 after:rounded-xs after:bg-current ${
          baja ? tono : 'text-text-muted'
        }`}
      >
        <span className="rounded-xs bg-current" style={{ width: `${Math.max(4, porcentaje)}%` }} />
      </span>
      <b className={`num text-metric-lg leading-none ${tono}`}>{porcentaje} %</b>
      <span className="text-body text-text-muted">
        {TEXTO_BATERIA[estado]}.{' '}
        {accion && (
          <span className={critica ? 'text-danger' : 'font-medium text-text'}>{accion}</span>
        )}
      </span>
    </div>
  )
}

/* PENDIENTE (backend de batería): el equipo todavía no informa si tiene batería
   ni su nivel. Se muestra con datos de ejemplo, marcados como tales. */
export function SeccionBateria() {
  return (
    <section aria-labelledby="titulo-bateria">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="titulo-bateria" className="text-heading-lg">
          Batería
        </h2>
        <span className="micro">Datos de ejemplo</span>
      </div>
      <div className="mt-3.5 flex flex-col gap-4 border-y border-border-control py-5">
        <Bateria porcentaje={72} estado="descargando" />
        <AvisoPendiente>
          el equipo todavía no informa batería. Estos datos son de ejemplo; con datos reales, un
          equipo sin batería no muestra esta sección.
        </AvisoPendiente>
      </div>
    </section>
  )
}
