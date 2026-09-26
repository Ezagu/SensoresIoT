import { Link } from 'react-router-dom'
import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { FilaAjuste, ValorAjuste } from '@/components/ui/FilaAjuste'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { IconoChevron } from '@/components/layout/iconos'
import type { Alerta } from '@/tipos'
import type { SensorConMeta } from '../usarDispositivo'

/* Espeja dispositivo_service.INTERVALO_CONTACTO_SEG: el equipo habla cada 5 min
   publique o no, y de eso sale la detección de "dejó de reportar". */
const CONTACTO_MIN = 5

/* PENDIENTE (backend): el equipo todavía no informa por dónde se conecta
   (WiFi, LoRa y gateway) ni la intensidad de la señal. */
export function SeccionConectividad({ id }: { id: string }) {
  return (
    <SeccionAjustes id={id} titulo="Conectividad">
      <div className="flex flex-col">
        <FilaAjuste id="fila-enlace" titulo="Enlace">
          <ValorAjuste>—</ValorAjuste>
        </FilaAjuste>
        <FilaAjuste id="fila-senal" titulo="Señal">
          <ValorAjuste>—</ValorAjuste>
        </FilaAjuste>
        <FilaAjuste id="fila-contacto" titulo="Contacto">
          <ValorAjuste detalle="así se detecta si deja de reportar">
            Cada {CONTACTO_MIN} min, publique o no
          </ValorAjuste>
        </FilaAjuste>
      </div>
      <AvisoPendiente>
        el equipo todavía no informa el enlace (WiFi, o LoRa y su gateway) ni la señal.
      </AvisoPendiente>
    </SeccionAjustes>
  )
}

/* PENDIENTE (backend de batería): mismos datos de ejemplo que el detalle del
   equipo. Con datos reales, un equipo sin batería no muestra esta sección. */
export function SeccionEnergia({ id }: { id: string }) {
  return (
    <SeccionAjustes
      id={id}
      titulo="Energía"
      accion={<span className="micro">Datos de ejemplo</span>}
    >
      <div className="flex flex-col">
        <FilaAjuste id="fila-bateria" titulo="Batería">
          <ValorAjuste detalle="Descargando">
            <b className="num font-semibold">72 %</b>
          </ValorAjuste>
        </FilaAjuste>
        <FilaAjuste id="fila-solar" titulo="Panel solar">
          <ValorAjuste>Conectado</ValorAjuste>
        </FilaAjuste>
      </div>
      <AvisoPendiente>
        el equipo todavía no informa batería ni panel solar. Estos datos son de ejemplo.
      </AvisoPendiente>
    </SeccionAjustes>
  )
}

/* Las reglas se administran en el detalle del equipo, al lado del gráfico de
   su sensor: acá sólo cuántas hay y cuál está sonando. */
export function SeccionAlertas({
  id,
  dispositivoId,
  alertas,
  sensores,
}: {
  id: string
  dispositivoId: string
  alertas: Alerta[]
  sensores: SensorConMeta[]
}) {
  const disparadas = alertas.filter((a) => a.activa && a.estado === 'disparada')
  const nombre = (a: Alerta) =>
    a.nombre || sensores.find((s) => s.id === a.sensor_id)?.etiqueta || 'una regla'

  return (
    <SeccionAjustes id={id} titulo="Alertas">
      <FilaAjuste
        id="fila-reglas"
        titulo="Reglas"
        accion={
          <Link
            to={`/dispositivos/${dispositivoId}`}
            className="inline-flex items-center gap-1 text-body font-medium text-accent hover:text-text"
          >
            Ver en el equipo
            <IconoChevron className="size-3.5" />
          </Link>
        }
      >
        <ValorAjuste
          detalle={
            disparadas.length > 0 && (
              <span className="text-danger">
                {disparadas.length} disparada{disparadas.length > 1 ? 's' : ''}:{' '}
                {disparadas.map(nombre).join(', ')}
              </span>
            )
          }
        >
          {alertas.length === 0
            ? 'Sin reglas'
            : `${alertas.length} ${alertas.length === 1 ? 'regla' : 'reglas'}`}
        </ValorAjuste>
      </FilaAjuste>
    </SeccionAjustes>
  )
}
