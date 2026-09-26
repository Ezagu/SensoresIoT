import { Fragment, useMemo, useState } from 'react'
import { Boton, BotonLink } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Desplegable } from '@/components/ui/Desplegable'
import { Skeleton } from '@/components/ui/Skeleton'
import { Vacio } from '@/components/ui/Vacio'
import { useHistorial, type FiltroHistorial } from './usarHistorial'
import { medida } from '@/utils/formato'
import { fecha, fechaHora, horaSegundos } from '@/utils/tiempo'
import type { UmbralGrafico } from '@/utils/alertas'
import { TextoError } from '@/components/ui/TextoError'

/* El valor de un <input type="datetime-local"> no lleva zona: `new Date` lo
   interpreta en la hora local, que es justo lo que el usuario tipeó. */
const instante = (valor: string) => (valor ? new Date(valor) : undefined)

/* Es la lectura contra el corte, no el estado de la regla: una sola lectura
   afuera no dispara nada (hacen falta `muestras_confirmacion` seguidas), así
   que la columna se llama "contra umbral" y no "alerta". Devuelve para qué lado
   se fue, que es más útil que un sí/no cuando hay reglas en los dos sentidos. */
function cruzaUmbral(valor: number, umbrales: UmbralGrafico[]): 'sobre' | 'bajo' | null {
  if (umbrales.some((u) => u.condicion === 'mayor' && valor > u.umbral)) return 'sobre'
  if (umbrales.some((u) => u.condicion === 'menor' && valor < u.umbral)) return 'bajo'
  return null
}

export function BloqueHistorial({
  sensorId,
  unidad,
  umbrales,
}: {
  sensorId: string
  unidad: string
  umbrales: UmbralGrafico[]
}) {
  const [desdeStr, setDesdeStr] = useState('')
  const [hastaStr, setHastaStr] = useState('')

  const filtro: FiltroHistorial = useMemo(
    () => ({ desde: instante(desdeStr), hasta: instante(hastaStr) }),
    [desdeStr, hastaStr],
  )

  const filtrado = desdeStr !== '' || hastaStr !== ''

  function limpiar() {
    setDesdeStr('')
    setHastaStr('')
  }

  const {
    mediciones,
    cargando,
    cargandoMas,
    error,
    hayMas,
    cargarMas,
    retencionDias,
    cortadaPorFiltro,
  } = useHistorial(sensorId, filtro)

  const finPorRetencion = !cargando && !hayMas && !cortadaPorFiltro && retencionDias !== null

  return (
    <section aria-labelledby="titulo-lecturas">
      <div className="flex min-h-10 items-center justify-between gap-4">
        <h2 id="titulo-lecturas" className="text-heading-lg">
          Lecturas{' '}
          <span className="font-normal text-text-faint">· de la más nueva a la más vieja</span>
        </h2>
        {/* Guardado detrás de un botón: el rango por defecto —lo último que
            reportó— es el que sirve casi siempre. */}
        <Desplegable etiqueta="Rango" marcado={filtrado}>
          {(cerrar) => (
            <div className="flex flex-col gap-3">
              <Campo
                id="historial-desde"
                etiqueta="Desde"
                type="datetime-local"
                max={hastaStr || undefined}
                value={desdeStr}
                onChange={(e) => setDesdeStr(e.target.value)}
              />
              <Campo
                id="historial-hasta"
                etiqueta="Hasta"
                type="datetime-local"
                min={desdeStr || undefined}
                value={hastaStr}
                onChange={(e) => setHastaStr(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <Boton type="button" variante="texto" disabled={!filtrado} onClick={limpiar}>
                  Limpiar
                </Boton>
                <Boton type="button" variante="sutil" onClick={cerrar}>
                  Listo
                </Boton>
              </div>
            </div>
          )}
        </Desplegable>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {filtrado && (
          <p className="text-note-lg text-text-muted">
            Filtrado
            {desdeStr && (
              <>
                {' '}
                desde <span className="num text-text">{fechaHora(desdeStr)}</span>
              </>
            )}
            {hastaStr && (
              <>
                {' '}
                hasta <span className="num text-text">{fechaHora(hastaStr)}</span>
              </>
            )}
            .
          </p>
        )}

        {error && <TextoError>No pudimos cargar el historial: {error}</TextoError>}

        {cargando ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : mediciones.length === 0 ? (
          <Vacio
            titulo="Sin lecturas para mostrar"
            detalle="No hay mediciones en el rango elegido."
          />
        ) : (
          <table className="w-full text-body">
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="border-b border-border-control">
                <th className="micro py-2 pr-3 text-left font-medium">Hora</th>
                <th className="micro py-2 pr-3 text-right font-medium">Valor</th>
                <th className="micro py-2 text-right font-medium">Contra umbral</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mediciones.map((m, i) => {
                const dia = fecha(m.time)
                const abreDia = i === 0 || fecha(mediciones[i - 1].time) !== dia
                const lado = cruzaUmbral(m.value, umbrales)
                return (
                  <Fragment key={m.time}>
                    {abreDia && (
                      <tr>
                        <th
                          colSpan={3}
                          scope="colgroup"
                          className="micro pt-3.5 pb-1 text-left font-normal"
                        >
                          {dia}
                        </th>
                      </tr>
                    )}
                    <tr>
                      <td className="num py-2.25 pr-3 font-normal text-text">
                        {horaSegundos(m.time)}
                      </td>
                      <td
                        className={`num py-2.25 pr-3 text-right ${lado ? 'text-danger' : 'text-text'}`}
                      >
                        {medida(m.value, unidad)}
                      </td>
                      <td className="py-2.25 text-right">
                        {umbrales.length === 0 ? (
                          <span className="text-text-faint">—</span>
                        ) : lado ? (
                          <span className="text-danger">
                            {lado === 'sobre' ? 'Sobre umbral' : 'Bajo umbral'}
                          </span>
                        ) : (
                          <span className="text-text-muted">En rango</span>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}

        {finPorRetencion && (
          <p className="text-note-lg text-text-muted">
            Hasta acá llega lo que muestra tu plan: los últimos{' '}
            <span className="num">{retencionDias}</span> días. Lo anterior sigue guardado.{' '}
            <BotonLink variante="texto" to="/plan" className="px-0">
              Ver planes
            </BotonLink>
          </p>
        )}
      </div>

      {/* Sin paginar: el historial se lee hacia atrás y de a poco, así que lo
          que hace falta es seguir bajando, no saltar a una página cualquiera. */}
      {hayMas && (
        <div className="mt-3 flex justify-center">
          <Boton type="button" variante="sutil" disabled={cargandoMas} onClick={cargarMas}>
            {cargandoMas ? 'Cargando…' : `Cargar más`}
          </Boton>
        </div>
      )}
    </section>
  )
}
