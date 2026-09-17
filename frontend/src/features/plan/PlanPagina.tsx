import { useCallback } from 'react'
import { Banner } from '@/components/ui/Banner'
import { Bloque } from '@/components/ui/Bloque'
import { Boton } from '@/components/ui/Boton'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { useSesion } from '@/features/auth/sesion'
import { useCarga } from '@/hooks/usarCarga'
import { listarPlanes } from '@/services/consultas'
import { entero, intervalo } from '@/utils/formato'
import { fecha } from '@/utils/tiempo'
import type { MiPlan, Plan } from '@/tipos'

/* Qué da cada plan sale del catálogo y no está escrito acá: los gates que la app
   aplica leen esa misma fila de `planes`, así que una tabla a mano se
   desincroniza el día que alguien cambia un número en la base. */
type Fila = { concepto: string; nota: string; valor: (plan: Plan) => string }

const FILAS: Fila[] = [
  {
    concepto: 'Historial consultable',
    nota: 'Cuánto para atrás podés mirar. Lo anterior se sigue guardando igual.',
    valor: (p) => (p.retencion_dias === null ? 'Todo' : `${entero(p.retencion_dias)} días`),
  },
  {
    concepto: 'Muestreo mínimo',
    nota: 'Lo más seguido que un equipo puede guardar un dato.',
    valor: (p) => intervalo(p.intervalo_minimo_seg),
  },
  {
    concepto: 'Alertas por equipo',
    nota: 'Reglas de umbral sobre un sensor, con aviso por mail.',
    valor: (p) =>
      !p.puede_alertas ? 'No' : p.max_alertas === null ? 'Sin tope' : entero(p.max_alertas),
  },
  {
    concepto: 'Compartir acceso',
    nota: 'Invitar a otras personas a ver o editar tus equipos.',
    valor: (p) => (p.puede_compartir ? 'Sí' : 'No'),
  },
  {
    concepto: 'Export CSV',
    nota: 'Descargar el historial de un equipo entero, con todos sus sensores.',
    valor: (p) => (p.puede_exportar ? 'Incluido' : 'No'),
  },
  {
    concepto: 'Equipos por cuenta',
    nota: 'Cuántos equipos podés tener vinculados a la vez.',
    valor: (p) =>
      p.dispositivos_incluidos === null ? 'Sin tope' : entero(p.dispositivos_incluidos),
  },
]

/* Una cifra va en .num; «Sí», «Incluido» o «Todo» no son cifras. */
const esCifra = (texto: string) => /\d/.test(texto)

/* El estado registra la intención y no la vigencia: «cancelada pero paga hasta
   el 30» es normal, así que nunca se muestra el estado sin su fecha al lado. */
function vigencia({ plan, suscripcion }: MiPlan): string {
  if (suscripcion === null) return 'Es el plan de arranque: no vence ni hay que renovarlo.'

  const desde = `Desde el ${fecha(suscripcion.inicio_at)}.`
  if (suscripcion.estado === 'activa') {
    return suscripcion.fin_at === null
      ? desde
      : `${desde} Vigente hasta el ${fecha(suscripcion.fin_at)}.`
  }
  if (suscripcion.estado === 'cancelada') {
    return suscripcion.fin_at === null
      ? 'Cancelada.'
      : `Cancelada: seguís con ${plan.nombre} hasta el ${fecha(suscripcion.fin_at)}.`
  }
  return 'Revocada.'
}

function EsqueletoTabla() {
  return (
    <div className="flex flex-col gap-4 p-5">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function PlanPagina() {
  const { plan: miPlan } = useSesion()
  const cargar = useCallback((signal: AbortSignal) => listarPlanes(signal), [])
  const { datos: planes, cargando, error, refrescar } = useCarga(cargar)

  const esTuyo = (p: Plan) => p.id === miPlan?.plan.id
  const esPago = miPlan !== null && miPlan.plan.id !== 'free'
  const retencion = miPlan?.plan.retencion_dias ?? null

  return (
    <div className="flex max-w-180 flex-col gap-6">
      <section aria-label="Tu plan" className="flex flex-col gap-1">
        <h2 className="font-display text-hero font-semibold text-text">
          {miPlan ? `Plan ${miPlan.plan.nombre}` : 'Planes'}
        </h2>
        <p className="text-body text-text-muted">
          {miPlan
            ? vigencia(miPlan)
            : 'No pudimos leer cuál es tu plan. Abajo está lo que incluye cada uno.'}
        </p>
      </section>

      {/* La puerta cerrada con la llave a la vista: el plan limita lo que se ve,
          nunca lo que se guarda. */}
      {retencion !== null && (
        <Banner tono="info" titulo={`Tu plan guarda todo, pero muestra ${retencion} días`}>
          Cada lectura de tus equipos queda guardada completa. Lo que está fuera de la ventana no se
          borró: al pasar a premium aparece entero, sin huecos.
        </Banner>
      )}

      <Bloque titulo="Qué incluye cada plan" sinPadding>
        {cargando ? (
          <EsqueletoTabla />
        ) : !planes || planes.length === 0 ? (
          <Vacio
            titulo="No pudimos cargar los planes"
            detalle={error ?? 'El catálogo volvió vacío.'}
            accion={
              <Boton variante="sutil" onClick={refrescar}>
                Reintentar
              </Boton>
            }
          />
        ) : (
          <>
            <div className="px-5 py-1">
              <table className="w-full text-body">
                <colgroup>
                  <col />
                  {planes.map((p) => (
                    <col key={p.id} className="w-20" />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-border-control">
                    {/* El rótulo de esta columna ya lo dice el título del bloque. */}
                    <th className="py-2.5 pr-3 text-left">
                      <span className="sr-only">Concepto</span>
                    </th>
                    {planes.map((p) => (
                      <th
                        key={p.id}
                        className={`px-3 py-2.5 text-right text-tag font-semibold tracking-micro uppercase ${
                          esTuyo(p) ? 'bg-surface-2 text-accent' : 'text-text-muted'
                        }`}
                      >
                        {p.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {FILAS.map((fila) => (
                    <tr key={fila.concepto}>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-text">{fila.concepto}</p>
                        <p className="mt-0.5 text-note-lg text-text-faint">{fila.nota}</p>
                      </td>
                      {planes.map((p) => {
                        const texto = fila.valor(p)
                        return (
                          <td
                            key={p.id}
                            className={`px-3 py-3 text-right align-top ${esTuyo(p) ? 'bg-surface-2' : ''}`}
                          >
                            {/* Una ausencia se apaga, no se pinta de rojo: no es una falla. */}
                            <span
                              className={`${esCifra(texto) ? 'num' : 'font-medium'} ${
                                texto === 'No' ? 'text-text-faint' : 'text-text'
                              }`}
                            >
                              {texto}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!esPago && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border bg-surface-2 px-5 py-4">
                <p className="min-w-0 flex-1 text-body text-text-muted">
                  El precio se define al contratar: escribinos y lo vemos según cuántos equipos
                  tengas.
                </p>
                <Boton>Consultar premium</Boton>
              </div>
            )}
          </>
        )}
      </Bloque>

      <p className="max-w-125 text-note-lg text-text-faint">
        Los límites valen por equipo y salen del plan de su dueño: si alguien te compartió un equipo
        premium, ves su historial completo aunque tu cuenta sea free. El aviso de «dejó de reportar»
        no depende del plan, lo recibe todo el mundo.
      </p>
    </div>
  )
}
