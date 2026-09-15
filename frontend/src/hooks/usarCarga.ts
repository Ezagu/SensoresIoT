import { useCallback, useEffect, useRef, useState } from 'react'
import { mensajeDeError } from '@/services/api'

type Estado<T> = {
  datos: T | null
  cargando: boolean
  refrescando: boolean
  error: string | null
  /* El error tal cual lo tiró `cargar`, para distinguir un 404/403 de un fallo
     de red (ver ErrorDeCarga). */
  errorCrudo: unknown
  /* Cuándo llegó la última respuesta buena, para que la pantalla pueda decir
     cuán vieja es la foto que está mostrando. Se conserva si el poll falla. */
  actualizadoAt: string | null
}

const INICIAL = {
  datos: null,
  cargando: true,
  refrescando: false,
  error: null,
  errorCrudo: null,
  actualizadoAt: null,
}

/* Carga asíncrona con cancelación, refresco manual y polling opcional.
   `cargando` es sólo la primera carga (lo único que dispara esqueletos); una
   recarga con datos en pantalla es `refrescando` y los conserva si falla.
   `cargar` tiene que venir memoizado: su identidad reinicia el ciclo. */
export function useCarga<T>(
  cargar: (signal: AbortSignal) => Promise<T>,
  { intervaloMs }: { intervaloMs?: number } = {},
) {
  const [estado, setEstado] = useState<Estado<T>>(INICIAL)
  const [intento, setIntento] = useState(0)
  const enVuelo = useRef<AbortController | null>(null)

  const ejecutar = useCallback(async () => {
    // Un pedido por vez: si el fan-out tarda más que el intervalo, el próximo
    // tick no se encima con el anterior.
    if (enVuelo.current) return
    const control = new AbortController()
    enVuelo.current = control

    setEstado((previo) => ({
      ...previo,
      cargando: previo.datos === null,
      refrescando: previo.datos !== null,
      error: previo.datos === null ? null : previo.error,
      errorCrudo: previo.datos === null ? null : previo.errorCrudo,
    }))

    try {
      const datos = await cargar(control.signal)
      if (!control.signal.aborted) {
        setEstado({
          datos,
          cargando: false,
          refrescando: false,
          error: null,
          errorCrudo: null,
          actualizadoAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      if (!control.signal.aborted) {
        setEstado((previo) => ({
          ...previo,
          cargando: false,
          refrescando: false,
          error: mensajeDeError(err),
          errorCrudo: err,
        }))
      }
    } finally {
      if (enVuelo.current === control) enVuelo.current = null
    }
  }, [cargar])

  // `intento` no se lee acá: es la llave del ciclo, lo que hace que refrescar()
  // vuelva a disparar la carga.
  useEffect(() => {
    void ejecutar()
    return () => {
      enVuelo.current?.abort()
      enVuelo.current = null
    }
  }, [ejecutar, intento])

  /* En su propio efecto: cambiar sólo la cadencia reprograma el próximo tick sin
     perder la carga en vuelo ni disparar una de más. */
  useEffect(() => {
    if (!intervaloMs) return
    let temporizador: ReturnType<typeof setTimeout>

    function programar() {
      temporizador = setTimeout(() => {
        // En pestaña oculta no se gasta el request ni la batería; al volver a
        // estar visible se refresca al toque.
        if (!document.hidden) void ejecutar()
        programar()
      }, intervaloMs)
    }
    programar()

    function alVolverVisible() {
      if (!document.hidden) void ejecutar()
    }
    document.addEventListener('visibilitychange', alVolverVisible)

    return () => {
      clearTimeout(temporizador)
      document.removeEventListener('visibilitychange', alVolverVisible)
    }
  }, [ejecutar, intervaloMs])

  const refrescar = useCallback(() => setIntento((n) => n + 1), [])
  return { ...estado, refrescar }
}
