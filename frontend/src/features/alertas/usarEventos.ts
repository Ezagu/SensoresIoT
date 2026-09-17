import { useCallback, useState } from 'react'
import { listarEventosAlerta } from '@/services/consultas'
import { useCarga } from '@/hooks/usarCarga'
import type { AlertaEvento } from '@/tipos'

/* El log global hacia atrás en el tiempo, de a tramos. Mismo esquema que
   useHistorial: los tramos se guardan por cursor en vez de concatenarse al
   vuelo, para que un doble montaje o un reintento reescriban el mismo tramo en
   lugar de duplicarlo. */

const TAMANO_TRAMO = 40

type Tramo = {
  eventos: AlertaEvento[]
  /* null = el backend no tiene nada más viejo. */
  siguiente: string | null
}

const INICIO = 'inicio'
const llaveDe = (cursor: string | undefined) => cursor ?? INICIO

export function useEventosAlerta(cadenciaSeg: number | undefined) {
  const [cursores, setCursores] = useState<(string | undefined)[]>([undefined])
  const [tramos, setTramos] = useState<Record<string, Tramo>>({})
  const cursor = cursores[cursores.length - 1]

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<Tramo> => {
      const { eventos, siguiente_cursor } = await listarEventosAlerta(
        { cursor, limite: TAMANO_TRAMO },
        signal,
      )
      const tramo: Tramo = { eventos, siguiente: siguiente_cursor }
      setTramos((previo) => ({ ...previo, [llaveDe(cursor)]: tramo }))
      return tramo
    },
    [cursor],
  )

  /* Mientras se mira el presente el log se refresca solo, a la cadencia del
     equipo más rápido de la cartera — la misma que el resto de la pantalla, así
     la banda de arriba y el registro no se contradicen. Apenas se pide un tramo
     anterior el poll se apaga: nadie está leyendo lo de hace tres días para que
     se le mueva la lista. */
  const enElPresente = cursores.length === 1
  const { refrescar, ...estado } = useCarga(cargar, {
    intervaloMs: enElPresente && cadenciaSeg !== undefined ? cadenciaSeg * 1000 : undefined,
  })

  /* Actualizar vuelve al presente: pedir de nuevo el tramo más viejo cargado no
     es lo que busca nadie que aprieta el botón en una pantalla de alertas. Los
     tramos ya traídos se conservan hasta que los pise otra carga, así la lista
     no parpadea en blanco mientras llega la respuesta. */
  const reiniciar = useCallback(() => {
    setCursores((previo) => (previo.length === 1 ? previo : [undefined]))
    refrescar()
  }, [refrescar])

  const ultimo = tramos[llaveDe(cursor)]

  return {
    eventos: cursores.flatMap((c) => tramos[llaveDe(c)]?.eventos ?? []),
    cargando: estado.cargando,
    /* La lista ya está en pantalla: lo único que trabaja es el botón. */
    cargandoMas: estado.refrescando,
    error: estado.error,
    actualizadoAt: estado.actualizadoAt,
    hayMas: ultimo?.siguiente != null,
    cargarMas: () =>
      setCursores((previo) => {
        const siguiente = tramos[llaveDe(previo[previo.length - 1])]?.siguiente
        return siguiente == null ? previo : [...previo, siguiente]
      }),
    reiniciar,
  }
}
