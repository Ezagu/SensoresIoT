import { useCallback, useState } from 'react'
import { obtenerHistorial } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'
import type { Medicion } from '@/tipos'

/* "Últimas lecturas" hacia atrás en el tiempo, con filtro de fechas opcional
   resuelto del lado del cliente (el endpoint no acepta `desde`). */

export type FiltroHistorial = {
  desde?: Date
  hasta?: Date
  limite: number
}

export type PaginaHistorial = {
  mediciones: Medicion[]
  /* true = esta página es la última porque el filtro `desde` del cliente cortó
     la lista, no porque el backend se quedó sin cursor. */
  cortadaPorFiltro: boolean
  retencionDias: number | null
}

/* `cursores[pagina]` es el cursor con el que se pidió esa página (undefined en
   la primera): volver atrás no dispara un request nuevo. `clave` ata la pila al
   filtro que la armó — con otro filtro esos cursores no significan nada. */
type Paginacion = { clave: string; cursores: (string | undefined)[]; pagina: number }

const primeraPagina = (clave: string): Paginacion => ({ clave, cursores: [undefined], pagina: 0 })

export function useHistorial(sensorId: string, filtro: FiltroHistorial) {
  /* Las fechas se reducen a epoch antes de entrar a cualquier lista de
     dependencias: un Date como dep cambiaría de identidad en cada render. */
  const desdeMs = filtro.desde?.getTime()
  const hastaMs = filtro.hasta?.getTime()
  const { limite } = filtro
  const clave = `${sensorId}|${desdeMs}|${hastaMs}|${limite}`

  const [guardada, setPaginacion] = useState(() => primeraPagina(clave))
  // Derivado en el render y no en un efecto: cambiar el filtro no necesita un
  // commit de más para volver a la primera página.
  let paginacion = guardada
  if (guardada.clave !== clave) {
    paginacion = primeraPagina(clave)
    setPaginacion(paginacion)
  }
  const { pagina, cursores } = paginacion
  const cursor = cursores[pagina]

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<PaginaHistorial> => {
      const { mediciones, siguiente_cursor, retencion_dias } = await obtenerHistorial(
        sensorId,
        {
          cursor,
          hasta: cursor === undefined && hastaMs !== undefined ? new Date(hastaMs) : undefined,
          limite,
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

      if (!cortadaPorFiltro && siguiente_cursor !== null) {
        setPaginacion((previa) => {
          if (previa.clave !== clave || previa.cursores[pagina + 1] === siguiente_cursor) return previa
          return { ...previa, cursores: [...previa.cursores.slice(0, pagina + 1), siguiente_cursor] }
        })
      }

      return { mediciones: filas, cortadaPorFiltro, retencionDias: retencion_dias }
    },
    [sensorId, cursor, hastaMs, desdeMs, limite, pagina, clave],
  )

  const estado = useCarga(cargar)

  return {
    ...estado,
    pagina,
    hayAnterior: pagina > 0,
    haySiguiente: cursores[pagina + 1] !== undefined,
    anterior: () => setPaginacion((p) => (p.pagina > 0 ? { ...p, pagina: p.pagina - 1 } : p)),
    siguiente: () =>
      setPaginacion((p) => (p.cursores[p.pagina + 1] !== undefined ? { ...p, pagina: p.pagina + 1 } : p)),
  }
}
