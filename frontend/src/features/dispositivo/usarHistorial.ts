import { useCallback, useState } from 'react'
import { obtenerHistorial } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'
import type { Medicion } from '@/tipos'

/* "Últimas lecturas" hacia atrás en el tiempo, con filtro de fechas opcional
   resuelto del lado del cliente (el endpoint no acepta `desde`). */

export const TAMANO_TRAMO = 20

export type FiltroHistorial = {
  desde?: Date
  hasta?: Date
}

type Tramo = {
  mediciones: Medicion[]
  /* Cursor de lo que viene después: null = el backend no tiene más. */
  siguiente: string | null
  /* true = este tramo se cortó por el filtro `desde` del cliente, no porque el
     backend se haya quedado sin datos. */
  cortadaPorFiltro: boolean
  retencionDias: number | null
}

const INICIO = 'inicio'
const llaveDe = (cursor: string | undefined) => cursor ?? INICIO

/* La cadena de cursores pedidos, con lo que trajo cada uno. Se guarda por llave
   en vez de concatenarse al vuelo para que un doble montaje (StrictMode) o un
   reintento reescriban el mismo tramo en vez de duplicarlo. */
type Acumulado = { clave: string; cursores: (string | undefined)[]; tramos: Record<string, Tramo> }

const desdeCero = (clave: string): Acumulado => ({ clave, cursores: [undefined], tramos: {} })

export function useHistorial(sensorId: string, filtro: FiltroHistorial) {
  /* Las fechas se reducen a epoch antes de entrar a cualquier lista de
     dependencias: un Date como dep cambiaría de identidad en cada render. */
  const desdeMs = filtro.desde?.getTime()
  const hastaMs = filtro.hasta?.getTime()
  const clave = `${sensorId}|${desdeMs}|${hastaMs}`

  const [guardado, setAcumulado] = useState(() => desdeCero(clave))
  // Derivado en el render y no en un efecto: cambiar el filtro no necesita un
  // commit de más para volver al principio.
  let acumulado = guardado
  if (guardado.clave !== clave) {
    acumulado = desdeCero(clave)
    setAcumulado(acumulado)
  }
  const { cursores, tramos } = acumulado
  const cursor = cursores[cursores.length - 1]

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<Tramo> => {
      const { mediciones, siguiente_cursor, retencion_dias } = await obtenerHistorial(
        sensorId,
        {
          cursor,
          hasta: cursor === undefined && hastaMs !== undefined ? new Date(hastaMs) : undefined,
          limite: TAMANO_TRAMO,
        },
        signal,
      )

      // Recorte por `desde` propio: las filas vienen time DESC, así que se corta
      // en la primera que ya cruzó el piso pedido.
      let filas = mediciones
      let cortadaPorFiltro = false
      if (desdeMs !== undefined) {
        const i = filas.findIndex((m) => new Date(m.time).getTime() < desdeMs)
        if (i !== -1) {
          filas = filas.slice(0, i)
          cortadaPorFiltro = true
        }
      }

      const tramo: Tramo = {
        mediciones: filas,
        siguiente: cortadaPorFiltro ? null : siguiente_cursor,
        cortadaPorFiltro,
        retencionDias: retencion_dias,
      }

      setAcumulado((previo) =>
        previo.clave !== clave ? previo : { ...previo, tramos: { ...previo.tramos, [llaveDe(cursor)]: tramo } },
      )
      return tramo
    },
    [sensorId, cursor, hastaMs, desdeMs, clave],
  )

  const estado = useCarga(cargar)

  const mediciones = cursores.flatMap((c) => tramos[llaveDe(c)]?.mediciones ?? [])
  const ultimo = tramos[llaveDe(cursor)]
  const hayMas = ultimo?.siguiente != null

  return {
    mediciones,
    cargando: estado.cargando,
    /* No es lo mismo que la primera carga: la tabla ya está en pantalla y lo
       único que pasa es que el botón está trabajando. */
    cargandoMas: estado.refrescando,
    error: estado.error,
    retencionDias: ultimo?.retencionDias ?? null,
    cortadaPorFiltro: ultimo?.cortadaPorFiltro ?? false,
    hayMas,
    cargarMas: () =>
      setAcumulado((previo) => {
        const siguiente = previo.tramos[llaveDe(previo.cursores[previo.cursores.length - 1])]?.siguiente
        if (siguiente == null) return previo
        return { ...previo, cursores: [...previo.cursores, siguiente] }
      }),
  }
}
