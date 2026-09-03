import { useCallback, useEffect, useState } from 'react'
import {
  cargarSensoresConMeta,
  pollDeVentana,
  reglaDestacada,
  resolverVentana,
  type SensorConMeta,
  type Ventana,
} from './dispositivos'
import { listarTiposSensor, obtenerDispositivo, obtenerGrafico, obtenerHistorial } from './consultas'
import { useCarga } from './usarCarga'
import type { AlertaConNotificar, DatosGrafico, Dispositivo, Medicion } from './tipos'

// --------------------------------------------------------------------------
// Detalle de un sensor: metadata estática (no pollea) + datos de la ventana
// elegida (único que pollea, y sólo en "En tiempo real" — mismo criterio que
// el detalle de dispositivo).
// --------------------------------------------------------------------------

/* `estadoHttp` (lib/api.ts) sólo reconoce AxiosError: un sensorId ajeno al
   dispositivo nunca golpea la red, así que se modela como un error propio en
   vez de fabricar un AxiosError falso. */
export class SensorNoEncontradoError extends Error {
  constructor() {
    super('Sensor no encontrado')
  }
}

export type DetalleSensorEstatico = {
  dispositivo: Dispositivo
  sensor: SensorConMeta
  alertas: AlertaConNotificar[]
}

/* El dispositivo_id sale de la URL (ruta anidada), así que no hace falta
   resolver GET /sensores/{id} primero: el fan-out de arriba es paralelo.
   Un sensorId que no está entre los del dispositivo se trata como 404 — link
   viejo o sensor de otro equipo — para que la pantalla lo maneje igual que un
   dispositivo inexistente. No pollea: se refresca sólo al montar y con
   `refrescar()`. */
export function useDetalleSensorEstatico(dispositivoId: string, sensorId: string) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DetalleSensorEstatico> => {
      const [dispositivo, tipos] = await Promise.all([
        obtenerDispositivo(dispositivoId, signal),
        listarTiposSensor(signal),
      ])

      const { sensores, alertas } = await cargarSensoresConMeta(dispositivoId, tipos, signal)
      const sensor = sensores.find((s) => s.id === sensorId)
      if (!sensor) throw new SensorNoEncontradoError()

      return {
        dispositivo,
        sensor,
        alertas: alertas.filter((a) => a.sensor_id === sensorId),
      }
    },
    [dispositivoId, sensorId],
  )

  return useCarga(cargar)
}

export type DatosSensor = {
  datos: DatosGrafico | null
  /* Última lectura cruda, independiente de la ventana elegida: no puede salir
     del último bucket del gráfico porque ese es un promedio y cambiaría de
     valor según el rango que se esté mirando. */
  ultima: Medicion | null
}

/* Único hook que pollea acá. La cadencia se aprende de `intervalo_seg` del
   propio gráfico (arranca sin pollear hasta conocerlo), mismo criterio que
   useGraficosDeSensores del detalle de dispositivo. */
export function useDatosSensor(sensorId: string, ventana: Ventana) {
  const [intervaloSeg, setIntervaloSeg] = useState<number | undefined>(undefined)

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DatosSensor> => {
      const { desde, hasta } = resolverVentana(ventana)
      const [datos, ultima] = await Promise.all([
        obtenerGrafico(sensorId, desde, hasta, signal).catch(() => null),
        // limite=1 es la lectura cruda más reciente, sin ventana ni promediar
        obtenerHistorial(sensorId, { limite: 1 }, signal)
          .then((r) => r.mediciones[0] ?? null)
          .catch(() => null),
      ])
      return { datos, ultima }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sensorId, ventana],
  )

  const estado = useCarga(cargar, { intervaloMs: pollDeVentana(ventana, intervaloSeg) })

  useEffect(() => {
    const actual = estado.datos?.datos?.intervalo_seg
    if (actual !== undefined && actual !== intervaloSeg) setIntervaloSeg(actual)
  }, [estado.datos, intervaloSeg])

  return { ...estado, intervaloSeg }
}

export { reglaDestacada }

// --------------------------------------------------------------------------
// Historial paginado: "últimas lecturas" hacia atrás en el tiempo, con
// filtro de fechas opcional resuelto del lado del cliente (el endpoint no
// acepta `desde`).
// --------------------------------------------------------------------------

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
     request "hacia adelante": ya tenemos el cursor guardado, así que sólo
     cambia la dependencia de `cargar` y useCarga hace el resto. */
  const [cursores, setCursores] = useState<(string | undefined)[]>([undefined])
  const [pagina, setPagina] = useState(0)

  /* Las fechas se reducen a epoch antes de tocar cualquier lista de
     dependencias: `filtro` se rearma en cada render del componente, así que un
     Date como dep haría que `cargar` cambie de identidad siempre y useCarga
     recargara en loop. */
  const desdeMs = filtro.desde?.getTime()
  const hastaMs = filtro.hasta?.getTime()
  const { limite } = filtro
  const cursor = cursores[pagina]

  /* Un filtro nuevo invalida la pila de cursores acumulada con el anterior:
     sin este reset, cambiar "filas por página" a mitad de lista reusaría
     cursores armados con el límite viejo. */
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
