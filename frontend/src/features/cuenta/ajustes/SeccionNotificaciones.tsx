import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton } from '@/components/ui/Boton'
import { FilaAjuste, idsDeFila } from '@/components/ui/FilaAjuste'
import { Interruptor } from '@/components/ui/Interruptor'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextoError } from '@/components/ui/TextoError'
import { useSesion } from '@/features/auth/sesion'
import { mensajeDeError } from '@/services/api'
import { actualizarPreferencias } from '@/services/consultas'
import type { ClavePreferencia, PreferenciasUpdatePayload } from '@/tipos'
import { usePreferencias } from './usarPreferencias'

/* Una familia de mails por renglón, no un canal por columna: el mail es el único
   canal que existe hoy, así que una grilla de canales sería una columna sola. */
const FAMILIAS: { clave: ClavePreferencia; titulo: string; descripcion: string }[] = [
  {
    clave: 'alertas',
    titulo: 'Alertas de tus equipos',
    descripcion:
      'Cuando un sensor cruza un umbral que configuraste, y cuando vuelve a la normalidad.',
  },
  {
    clave: 'accesos',
    titulo: 'Acceso a tus equipos',
    descripcion: 'Cuando alguien acepta una invitación tuya o deja de tener acceso a un equipo.',
  },
  {
    clave: 'inicio_sesion',
    titulo: 'Inicios de sesión',
    descripcion: 'Cuando entran a tu cuenta desde un navegador o un equipo que no reconocemos.',
  },
]

export function SeccionNotificaciones({ id }: { id: string }) {
  const { sesion } = useSesion()
  const { datos, cargando, error: errorCarga, refrescar } = usePreferencias()
  /* Optimista: el interruptor responde al click, no al round-trip. Lo pedido
     pisa lo cargado hasta que falle, y si falla se borra y vuelve solo. */
  const [pedidos, setPedidos] = useState<PreferenciasUpdatePayload>({})
  const [guardando, setGuardando] = useState<ClavePreferencia | null>(null)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  const preferencias = datos && { ...datos, ...pedidos }

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
    <SeccionAjustes
      id={id}
      titulo="Notificaciones"
      descripcion={
        sesion?.email ? <>Los mails salen a {sesion.email}.</> : 'Qué mails te mandamos.'
      }
    >
      {cargando ? (
        <div className="flex flex-col gap-4">
          {FAMILIAS.map((f) => (
            <Skeleton key={f.clave} className="h-10 w-full" />
          ))}
        </div>
      ) : !preferencias ? (
        <div className="flex flex-col items-start gap-2.5">
          <TextoError>{errorCarga ?? 'No pudimos cargar tus preferencias.'}</TextoError>
          <Boton variante="fantasma" onClick={refrescar}>
            Reintentar
          </Boton>
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border">
            {FAMILIAS.map(({ clave, titulo, descripcion }) => {
              const ids = idsDeFila(clave)
              return (
                <FilaAjuste key={clave} id={clave} titulo={titulo} descripcion={descripcion}>
                  <Interruptor
                    activo={preferencias[clave]}
                    onCambiar={(activo) => void cambiar(clave, activo)}
                    etiquetaId={ids.etiqueta}
                    descripcionId={ids.descripcion}
                    disabled={guardando === clave}
                  />
                </FilaAjuste>
              )
            })}
          </div>

          {errorGuardado && <TextoError>{errorGuardado}</TextoError>}

          <div className="flex flex-col gap-2 border-t border-border pt-3 text-note text-text-faint">
            <p>
              Para dejar de recibir alertas de un equipo puntual sin apagar el resto, silencialo
              desde{' '}
              <Link to="/dispositivos" className="font-medium text-accent hover:underline">
                sus ajustes
              </Link>
              .
            </p>
            <p>
              Los mails de verificación y de recuperación de contraseña se mandan siempre: son parte
              de cómo funciona la cuenta.
            </p>
          </div>
        </>
      )}
    </SeccionAjustes>
  )
}
