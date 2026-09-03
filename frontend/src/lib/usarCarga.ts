import { useCallback, useEffect, useRef, useState } from 'react'
import { mensajeDeError } from './api'

type Estado<T> = {
  datos: T | null
  cargando: boolean
  refrescando: boolean
  error: string | null
  /* El error tal cual lo tiró `cargar` (p. ej. un AxiosError): sirve para
     distinguir 404/403 de un fallo de red genérico cuando la pantalla
     necesita una respuesta distinta para cada caso (ver DetalleDispositivo). */
  errorCrudo: unknown
}

type Opciones = {
  /* Sin esto, la carga es una sola vez (comportamiento anterior) */
  intervaloMs?: number
}

/* Carga asíncrona con cancelación al desmontar, refresco manual y polling
   opcional.
   - `cargando` es sólo la primera carga (todavía no hay `datos`): es lo único
     que dispara esqueletos.
   - Una recarga (poll o `refrescar`) con datos ya en pantalla es `refrescando`:
     no reemplaza la vista, y si falla conserva los `datos` anteriores en vez
     de vaciar la pantalla por un error transitorio de red.
   `cargar` tiene que venir memoizado (useCallback): su identidad decide cuándo
   se reinicia el ciclo de carga (y el poll, si hay). */
export function useCarga<T>(cargar: (signal: AbortSignal) => Promise<T>, opciones: Opciones = {}) {
  const { intervaloMs } = opciones
  const [estado, setEstado] = useState<Estado<T>>({
    datos: null,
    cargando: true,
    refrescando: false,
    error: null,
    errorCrudo: null,
  })
  const [intento, setIntento] = useState(0)

  /* Estado actual accesible sin entrar en las deps del efecto de abajo. */
  const estadoRef = useRef(estado)
  estadoRef.current = estado

  /* Identifica el ciclo de carga (de qué `cargar`/intento viene el poll en
     curso). Si sólo cambió `intervaloMs` (p. ej. el intervalo del equipo recién
     resuelto), es el mismo ciclo: no hay que perder la carga en vuelo ni
     disparar una de más, sólo reprogramar el próximo tick con la cadencia
     nueva. */
  const cicloRef = useRef<{ cargar: typeof cargar; intento: number } | null>(null)

  useEffect(() => {
    let vigente = true
    let control: AbortController | null = null
    let temporizador: ReturnType<typeof setTimeout> | undefined
    /* Local al efecto, no un ref del componente: con StrictMode React monta,
       limpia y vuelve a montar: un flag que sobreviva a la limpieza deja a la
       segunda invocación creyendo que ya hay un pedido en vuelo (el de la
       primera, recién abortado) y la pantalla nunca carga. */
    let enVuelo = false

    const mismoCiclo =
      cicloRef.current?.cargar === cargar && cicloRef.current?.intento === intento
    cicloRef.current = { cargar, intento }

    async function ejecutar() {
      // Un poll por vez: si el fan-out tarda más que el intervalo, no se
      // encima con el siguiente disparo.
      if (enVuelo) return
      enVuelo = true
      control = new AbortController()

      setEstado((previo) => ({
        datos: previo.datos,
        cargando: previo.datos === null,
        refrescando: previo.datos !== null,
        error: previo.datos === null ? null : previo.error,
        errorCrudo: previo.datos === null ? null : previo.errorCrudo,
      }))

      try {
        const datos = await cargar(control.signal)
        if (vigente) {
          setEstado({ datos, cargando: false, refrescando: false, error: null, errorCrudo: null })
        }
      } catch (err) {
        // Abortar rechaza la promesa: no es un error que mostrar
        if (control.signal.aborted) return
        if (vigente) {
          setEstado((previo) => ({
            datos: previo.datos,
            cargando: false,
            refrescando: false,
            error: mensajeDeError(err),
            errorCrudo: err,
          }))
        }
      } finally {
        enVuelo = false
      }
    }

    function programar() {
      if (!intervaloMs) return
      temporizador = setTimeout(() => {
        // En pestaña oculta no vale la pena gastar el request ni la batería;
        // al volver a estar visible se refresca al toque (más abajo).
        if (!document.hidden) ejecutar().finally(programar)
        else programar()
      }, intervaloMs)
    }

    // Mismo ciclo con datos ya en pantalla: sólo el intervalo cambió, no hace
    // falta recargar — se reprograma con la cadencia nueva y listo. Sin datos
    // todavía (primera carga, incluso la segunda pasada de StrictMode) hay que
    // ejecutar sí o sí, o la pantalla se queda colgada en el esqueleto.
    if (mismoCiclo && estadoRef.current.datos !== null) {
      programar()
    } else {
      ejecutar().finally(programar)
    }

    function alVolverVisible() {
      if (!document.hidden) ejecutar()
    }
    if (intervaloMs) document.addEventListener('visibilitychange', alVolverVisible)

    return () => {
      vigente = false
      control?.abort()
      clearTimeout(temporizador)
      if (intervaloMs) document.removeEventListener('visibilitychange', alVolverVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar, intento, intervaloMs])

  const refrescar = useCallback(() => setIntento((n) => n + 1), [])
  return { ...estado, refrescar }
}

/* Re-render periódico para lo que se deriva de la hora actual (el "hace X" y
   el estado de conexión): sin esto un dispositivo queda "En línea" para siempre
   aunque haya dejado de reportar mientras la pestaña está abierta. */
export function useAhora(intervaloMs: number) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}
