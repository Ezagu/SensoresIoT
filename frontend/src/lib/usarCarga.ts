import { useCallback, useEffect, useState } from 'react'
import { mensajeDeError } from './api'

type Estado<T> = {
  datos: T | null
  cargando: boolean
  error: string | null
}

/* Carga asíncrona con cancelación al desmontar y reintento manual.
   `cargar` tiene que venir memoizado (useCallback): su identidad es la que
   decide cuándo se vuelve a pedir. */
export function useCarga<T>(cargar: (signal: AbortSignal) => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T>>({ datos: null, cargando: true, error: null })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const control = new AbortController()
    setEstado((previo) => ({ ...previo, cargando: true, error: null }))

    cargar(control.signal)
      .then((datos) => {
        if (!control.signal.aborted) setEstado({ datos, cargando: false, error: null })
      })
      .catch((err) => {
        // Abortar rechaza la promesa: no es un error que mostrar
        if (control.signal.aborted) return
        setEstado({ datos: null, cargando: false, error: mensajeDeError(err) })
      })

    return () => control.abort()
  }, [cargar, intento])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])
  return { ...estado, reintentar }
}

/* Re-render periódico para lo que se deriva de la hora actual (el "hace X" y
   el estado de conexión): sin esto un equipo queda "En línea" para siempre
   aunque haya dejado de reportar mientras la pestaña está abierta. */
export function useAhora(intervaloMs: number) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}
