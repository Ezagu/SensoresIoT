import { useCallback, useEffect, useState } from 'react'
import { obtenerHistorial } from '@/lib/consultas'
import { useCarga } from '@/lib/usarCarga'
import type { Medicion } from '@/lib/tipos'

/* "Últimas lecturas" hacia atrás en el tiempo, con filtro de fechas opcional
   resuelto del lado del cliente (el endpoint no acepta `desde`). */

export type FiltroHistorial = {
  desde?: Date
  hasta?: Date
  limite: number
}

export type PaginaHistorial = {
  mediciones: Medicion[]
  /* true = esta página es la última porque el filtro `desde` del cliente
     cortó la lista, no porque el backend se quedó sin cursor. Distingue el
     recorte propio del recorte por retención del plan. */
  cortadaPorFiltro: boolean
  retencionDias: number | null
}

export function useHistorial(sensorId: string, filtro: FiltroHistorial) {
  /* Pila de cursores: cursores[pagina] es el cursor con el que se pidió esa
     página (undefined en la primera). Cambiar de página no dispara un nuevo
     request "hacia adelante": ya tenemos el cursor guardado. */
  const [cursores, setCursores] = useState<(string | undefined)[]>([undefined])
  const [pagina, setPagina] = useState(0)

  /* Las fechas se reducen a epoch antes de entrar a cualquier lista de
     dependencias: un Date como dep haría que `cargar` cambie de identidad
     siempre y useCarga recargara en loop. */
  const desdeMs = filtro.desde?.getTime()
  const hastaMs = filtro.hasta?.getTime()
  const { limite } = filtro
  const cursor = cursores[pagina]

  /* Un filtro nuevo invalida la pila de cursores del anterior: sin este
     reset, cambiar "filas por página" a mitad de lista reusaría cursores
     armados con el límite viejo. */
  useEffect(() => {
    setCursores([undefined])
    setPagina(0)
  }, [sensorId, desdeMs, hastaMs, limite])

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

      // Recorte por `desde` propio: las filas vienen time DESC, así que se
      // corta en la primera que ya cruzó el piso pedido.
      let filas = mediciones
      let cortadaPorFiltro = false
      if (desdeMs !== undefined) {
        const i = filas.findIndex((m) => new Date(m.time).getTime() < desdeMs)
        if (i !== -1) {
          filas = filas.slice(0, i)
          cortadaPorFiltro = true
        }
      }

      const haySiguiente = !cortadaPorFiltro && siguiente_cursor !== null
      setCursores((prev) => {
        if (!haySiguiente || prev[pagina + 1] === siguiente_cursor) return prev
        const copia = prev.slice(0, pagina + 1)
        copia.push(siguiente_cursor as string)
        return copia
      })

      return { mediciones: filas, cortadaPorFiltro, retencionDias: retencion_dias }
    },
    [sensorId, cursor, hastaMs, desdeMs, limite, pagina],
  )

  const estado = useCarga(cargar)

  const hayAnterior = pagina > 0
  const haySiguiente = cursores[pagina + 1] !== undefined

  function anterior() {
    if (hayAnterior) setPagina((p) => p - 1)
  }
  function siguiente() {
    if (haySiguiente) setPagina((p) => p + 1)
  }

  return { ...estado, pagina, hayAnterior, haySiguiente, anterior, siguiente }
}
