import { useCallback, useState } from 'react'
import { AvisoPendiente } from '@/components/ui/AvisoPendiente'
import { Boton } from '@/components/ui/Boton'
import { FilaAjuste, idsDeFila, ValorAjuste } from '@/components/ui/FilaAjuste'
import { Interruptor } from '@/components/ui/Interruptor'
import { Modal } from '@/components/ui/Modal'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { useSesion } from '@/features/auth/sesion'
import { useCarga } from '@/hooks/usarCarga'
import { useDispositivos } from '@/hooks/usarDispositivos'
import { estadoHttp, mensajeDeError } from '@/services/api'
import {
  actualizarPreferencias,
  configurarNotificaciones,
  obtenerDispositivo,
} from '@/services/consultas'
import type { ClavePreferencia, PreferenciasUpdatePayload } from '@/tipos'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { usePreferencias } from './usarPreferencias'

/* Una familia de mails por renglón, no un canal por columna: el mail es el único
   canal que existe hoy, así que una grilla de canales sería una columna sola. */
const FAMILIAS: { clave: ClavePreferencia; titulo: string; descripcion: string }[] = [
  {
    clave: 'alertas',
    titulo: 'Alertas de tus equipos',
    descripcion: 'Cuando un sensor cruza un umbral y cuando vuelve a la normalidad.',
  },
  {
    clave: 'accesos',
    titulo: 'Acceso a tus equipos',
    descripcion: 'Cuando alguien acepta una invitación tuya o deja de tener acceso.',
  },
  {
    clave: 'inicio_sesion',
    titulo: 'Inicios de sesión',
    descripcion: 'Cuando entran a tu cuenta desde un navegador que no reconocemos.',
  },
]

type Silencio = { id: string; nombre: string; notificar: boolean }

/* El silencio es por equipo (`usuario_dispositivo.notificar`) y el panel no lo
   trae: se lee del detalle de cada uno. Carteras chicas, un pedido por equipo. */
function useSilencios() {
  const { datos } = useDispositivos()
  const ids = (datos ?? []).map((d) => d.id).join(',')
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<Silencio[]> => {
      const detalles = await Promise.all(
        (ids ? ids.split(',') : []).map((id) => obtenerDispositivo(id, signal)),
      )
      return detalles
        .filter((d) => d.notificar !== null)
        .map((d) => ({
          id: d.id,
          nombre: nombreDeDispositivo(d.id, d.nombre),
          notificar: !!d.notificar,
        }))
    },
    [ids],
  )
  return useCarga(cargar)
}

function ModalEquipos({
  equipos,
  onCerrar,
  onCambio,
}: {
  equipos: Silencio[]
  onCerrar: () => void
  onCambio: () => void
}) {
  const [pedidos, setPedidos] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  async function cambiar(id: string, notificar: boolean) {
    setPedidos((p) => ({ ...p, [id]: notificar }))
    setError(null)
    try {
      await configurarNotificaciones(id, { notificar })
      onCambio()
    } catch (err) {
      setPedidos(({ [id]: _descartado, ...resto }) => resto)
      setError(mensajeDeError(err, 'No pudimos cambiar el aviso de ese equipo.'))
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Avisos por equipo">
      <p className="text-body text-text-muted">
        Silenciar un equipo apaga sus mails sólo para vos: quienes también tienen acceso los siguen
        recibiendo.
      </p>
      <div className="mt-3 flex flex-col">
        {equipos.map((e) => {
          const ids = idsDeFila(`silencio-${e.id}`)
          return (
            <div
              key={e.id}
              className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
            >
              <span id={ids.etiqueta} className="truncate text-body-lg">
                {e.nombre}
              </span>
              <Interruptor
                activo={pedidos[e.id] ?? e.notificar}
                onCambiar={(v) => void cambiar(e.id, v)}
                etiquetaId={ids.etiqueta}
              />
            </div>
          )
        })}
      </div>
      {error && <TextoError>{error}</TextoError>}
    </Modal>
  )
}

export function SeccionNotificaciones({ id }: { id: string }) {
  const { sesion } = useSesion()
  const { datos, cargando, error: errorCarga, errorCrudo, refrescar } = usePreferencias()
  const silencios = useSilencios()
  const [eligiendo, setEligiendo] = useState(false)
  /* Optimista: el interruptor responde al click, no al round-trip. Lo pedido
     pisa lo cargado hasta que falle, y si falla se borra y vuelve solo. */
  const [pedidos, setPedidos] = useState<PreferenciasUpdatePayload>({})
  const [guardando, setGuardando] = useState<ClavePreferencia | null>(null)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  const preferencias = datos && { ...datos, ...pedidos }
  const equipos = silencios.datos ?? []
  const silenciados = equipos.filter((e) => !e.notificar)

  async function cambiar(clave: ClavePreferencia, activo: boolean) {
    setPedidos((p) => ({ ...p, [clave]: activo }))
    setGuardando(clave)
    setErrorGuardado(null)
    try {
      await actualizarPreferencias({ [clave]: activo })
    } catch (err) {
      setPedidos(({ [clave]: _descartado, ...resto }) => resto)
      setErrorGuardado(mensajeDeError(err, 'No pudimos guardar la preferencia.'))
    } finally {
      setGuardando(null)
    }
  }

  return (
    <SeccionAjustes id={id} titulo="Avisos">
      <div className="flex flex-col">
        <FilaAjuste id="fila-destino" titulo="Llegan a">
          <ValorAjuste detalle="por email">{sesion?.email}</ValorAjuste>
        </FilaAjuste>

        <FilaAjuste
          id="fila-equipos"
          titulo="Equipos"
          accion={
            equipos.length > 0 && (
              <button
                type="button"
                onClick={() => setEligiendo(true)}
                className="cursor-pointer text-body font-medium text-accent hover:text-text"
              >
                Elegir equipos
              </button>
            )
          }
        >
          {silencios.cargando ? (
            <Skeleton className="h-5 w-56" />
          ) : (
            <ValorAjuste
              detalle={
                silenciados.length > 0 &&
                `silenciado${silenciados.length > 1 ? 's' : ''}: ${silenciados.map((e) => e.nombre).join(', ')}`
              }
            >
              Recibís avisos de {equipos.length - silenciados.length} de {equipos.length}
            </ValorAjuste>
          )}
        </FilaAjuste>

        {cargando ? (
          <Skeleton className="my-3 h-10 w-full" />
        ) : !preferencias && estadoHttp(errorCrudo) === 404 ? (
          /* PENDIENTE (backend): GET/PATCH /auth/me/preferencias no existen todavía. */
          <div className="py-3">
            <AvisoPendiente>
              las preferencias por tipo de mail (alertas, accesos, inicios de sesión) todavía no
              están en el backend.
            </AvisoPendiente>
          </div>
        ) : !preferencias ? (
          <div className="flex items-center gap-3 py-3">
            <TextoError>{errorCarga ?? 'No pudimos cargar tus preferencias.'}</TextoError>
            <Boton variante="fantasma" onClick={refrescar}>
              Reintentar
            </Boton>
          </div>
        ) : (
          FAMILIAS.map(({ clave, titulo, descripcion }) => {
            const ids = idsDeFila(clave)
            return (
              <FilaAjuste
                key={clave}
                id={clave}
                titulo={titulo}
                accion={
                  <Interruptor
                    activo={preferencias[clave]}
                    onCambiar={(activo) => void cambiar(clave, activo)}
                    etiquetaId={ids.etiqueta}
                    descripcionId={ids.descripcion}
                    disabled={guardando === clave}
                  />
                }
              >
                <p id={ids.descripcion} className="text-body text-text-muted">
                  {descripcion}
                </p>
              </FilaAjuste>
            )
          })
        )}
      </div>
      {errorGuardado && <TextoError>{errorGuardado}</TextoError>}
      <p className="text-note text-text-faint">
        Los mails de verificación y de recuperación de contraseña se mandan siempre: son parte de
        cómo funciona la cuenta.
      </p>

      {eligiendo && (
        <ModalEquipos
          equipos={equipos}
          onCerrar={() => setEligiendo(false)}
          onCambio={silencios.refrescar}
        />
      )}
    </SeccionAjustes>
  )
}
