import { useCallback, useEffect, useState } from 'react'
import { useSesion } from './auth'
import {
  listarAlertas,
  listarSensores,
  listarTiposSensor,
  obtenerDispositivo,
  obtenerGrafico,
  obtenerPanel,
} from './consultas'
import { etiquetarSensores } from './sensores'
import { useCarga } from './usarCarga'
import type {
  AlertaConNotificar,
  DatosGrafico,
  Dispositivo,
  DispositivoConRol,
  DispositivoDetalle,
  DispositivoResumen,
  TipoSensor,
} from './tipos'

/* Piso de muestreo mientras el intervalo real todavía no se conoce (antes de
   que cargue el primer gráfico, en el detalle): sólo afecta al umbral con el
   que se decide "en línea", nunca a los datos. */
const INTERVALO_FALLBACK_SEG = 60

/* Misma cuenta que _obtener_intervalo_minimo: el plan es piso, no valor fijo.
   Se resuelve al renderizar y no al pedir los datos, porque el plan llega
   después de la sesión y meterlo en el fetch recargaría todo cuando aparece
   — el intervalo sólo decide el estado de conexión, no qué se pide.
   El piso real es el del DUEÑO del dispositivo y no se expone acá; es sólo un
   fallback hasta que se conoce el `intervalo_seg` exacto que ya trae el panel
   (DispositivoResumen) o el gráfico (DatosGrafico). */
export function intervaloEfectivo(dispositivo: Dispositivo, pisoPlan: number | undefined) {
  return Math.max(dispositivo.intervalo_configurado_seg ?? 0, pisoPlan ?? INTERVALO_FALLBACK_SEG)
}

/* El dispositivo puede no tener nombre cargado: el id corto lo distingue del resto
   sin obligar a mostrar un UUID entero. */
export function nombreDeDispositivo(id: string, nombre: string | null) {
  return nombre?.trim() || `Dispositivo ${id.slice(0, 8)}`
}

/* Sensor activo con su metadata resuelta (etiqueta/unidad/color por tipo), sin
   lecturas: es la parte estática del detalle (no pollea) y la que consumen
   BloqueAlertas / BloqueSensor antes de cruzarla con el gráfico. */
export type SensorConMeta = {
  id: string
  tipoSensorId: number
  etiqueta: string
  unidad: string
  color: string
}

export async function cargarSensoresConMeta(
  dispositivoId: string,
  tipos: TipoSensor[],
  signal: AbortSignal,
): Promise<{ sensores: SensorConMeta[]; alertas: AlertaConNotificar[] }> {
  const [sensores, alertas] = await Promise.all([
    listarSensores(dispositivoId, signal),
    listarAlertas(dispositivoId, signal),
  ])

  const activos = sensores.filter((s) => s.activo)
  const etiquetas = etiquetarSensores(activos, tipos)

  return {
    sensores: activos.map((sensor) => {
      const meta = etiquetas.get(sensor.id)
      return {
        id: sensor.id,
        tipoSensorId: sensor.tipo_sensor_id,
        etiqueta: meta?.etiqueta ?? 'Sensor',
        unidad: meta?.unidad ?? '',
        color: meta?.color ?? 'var(--color-text-muted)',
      }
    }),
    alertas,
  }
}

/* Lo que necesita el gráfico: la metadata más los datos del rango elegido.
   `datos` es null cuando el sensor no tiene lecturas en el rango, el request
   puntual falló, o el gráfico todavía no polleó (ver useGraficosDeSensores):
   un sensor caído no puede tirar abajo el resto del dispositivo. */
export type SensorConDatos = SensorConMeta & { datos: DatosGrafico | null }

// --------------------------------------------------------------------------
// Panel: todos los dispositivos, resueltos en 1 sólo request (GET .../panel).
// --------------------------------------------------------------------------

export type SensorPanel = {
  id: string
  etiqueta: string
  unidad: string
  color: string
  ultimo: number | null
  /* `time` de esa lectura. Con él cada fila resuelve por su cuenta si está
     desactualizada, sin que el last_seen_at del dispositivo tape a un sensor que
     se rompió mientras el resto sigue reportando. */
  ultimoAt: string | null
  disparada: boolean
}

export type DispositivoPanel = {
  dispositivo: DispositivoConRol
  sensores: SensorPanel[]
  alertasDisparadas: number
  /* Resuelto en el backend con el plan del DUEÑO: exacto también para un
     dispositivo compartido, a diferencia del intervalo_configurado_seg solo. */
  intervaloEfectivoSeg: number
}

/* El panel arma su propio catálogo de tipos de sensor a partir de lo que ya
   vino en la respuesta (tipo_sensor_id/tipo_nombre/unidad por sensor), sin
   pedir `/tipos-sensor/` aparte: es lo único que necesita etiquetarSensores. */
function catalogoDeTipos(sensores: DispositivoResumen['sensores']): TipoSensor[] {
  const vistos = new Map<number, TipoSensor>()
  for (const s of sensores) {
    if (!vistos.has(s.tipo_sensor_id)) {
      vistos.set(s.tipo_sensor_id, { id: s.tipo_sensor_id, nombre: s.tipo_nombre, unidad: s.unidad })
    }
  }
  return [...vistos.values()]
}

function panelADispositivo(d: DispositivoResumen): DispositivoPanel {
  const etiquetas = etiquetarSensores(
    d.sensores.map((s) => ({ id: s.id, tipo_sensor_id: s.tipo_sensor_id })),
    catalogoDeTipos(d.sensores),
  )

  return {
    dispositivo: {
      id: d.id,
      nombre: d.nombre,
      ubicacion: d.ubicacion,
      descripcion: d.descripcion,
      activo: d.activo,
      last_seen_at: d.last_seen_at,
      first_connected_at: d.first_connected_at,
      intervalo_configurado_seg: d.intervalo_configurado_seg,
      rol: d.rol,
    },
    alertasDisparadas: d.alertas_disparadas,
    intervaloEfectivoSeg: d.intervalo_efectivo_seg,
    sensores: d.sensores.map((s): SensorPanel => {
      const meta = etiquetas.get(s.id)
      return {
        id: s.id,
        etiqueta: meta?.etiqueta ?? 'Sensor',
        unidad: meta?.unidad ?? s.unidad,
        color: meta?.color ?? 'var(--color-text-muted)',
        ultimo: s.ultimo_valor,
        ultimoAt: s.ultimo_at,
        disparada: s.disparada,
      }
    }),
  }
}

/* Los dispositivos del panel con la última lectura de cada sensor, en un único
   GET /usuarios/{id}/panel (antes: 2 + 2·dispositivos + sensores requests).
   La cadencia del poll se aprende del propio resultado: arranca sin pollear y,
   apenas se conoce el intervalo efectivo mínimo de la cartera, se activa a ese
   ritmo (useCarga reprograma el tick sin perder los datos ya cargados). */
export function useDispositivos() {
  const { sesion } = useSesion()
  const usuarioId = sesion?.usuario_id
  const [intervaloMs, setIntervaloMs] = useState<number | undefined>(undefined)

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DispositivoPanel[]> => {
      if (!usuarioId) return []
      const panel = await obtenerPanel(usuarioId, signal)
      return panel.dispositivos.map(panelADispositivo)
    },
    [usuarioId],
  )

  const estado = useCarga(cargar, { intervaloMs })

  useEffect(() => {
    if (!estado.datos || estado.datos.length === 0) return
    const menorSeg = Math.min(...estado.datos.map((d) => d.intervaloEfectivoSeg))
    const nuevo = menorSeg * 1000
    setIntervaloMs((actual) => (actual === nuevo ? actual : nuevo))
  }, [estado.datos])

  return estado
}

/* Para el detalle (BloqueAlertas): todas las reglas del sensor, activas o no
   — el usuario administra ambas. */
export function agruparAlertasPorSensor(alertas: AlertaConNotificar[]) {
  const mapa = new Map<string, AlertaConNotificar[]>()
  for (const alerta of alertas) {
    const acumuladas = mapa.get(alerta.sensor_id) ?? []
    acumuladas.push(alerta)
    mapa.set(alerta.sensor_id, acumuladas)
  }
  return mapa
}

/* Sólo reglas activas: el umbral del gráfico del detalle y el flag de
   disparada del panel. */
function reglasPorSensor(alertas: AlertaConNotificar[]) {
  const mapa = new Map<string, AlertaConNotificar[]>()
  for (const alerta of alertas) {
    if (!alerta.activa) continue
    const acumuladas = mapa.get(alerta.sensor_id) ?? []
    acumuladas.push(alerta)
    mapa.set(alerta.sensor_id, acumuladas)
  }
  return mapa
}

/* Regla a resaltar en el gráfico: la disparada si hay alguna, si no la primera
   activa. Mismo criterio en panel y detalle. */
export function reglaDestacada(alertas: AlertaConNotificar[], sensorId: string) {
  const reglas = reglasPorSensor(alertas).get(sensorId) ?? []
  return reglas.find((r) => r.estado === 'disparada') ?? reglas[0]
}

// --------------------------------------------------------------------------
// Detalle: un dispositivo, gráfico completo por sensor en el rango elegido
// --------------------------------------------------------------------------

export type RangoGrafico = 'tiempo-real' | '24h' | '7d' | '30d' | '6m' | '1a'

/* Orden y etiquetas del selector de rango del detalle, en un solo lugar. */
export const RANGOS: { valor: RangoGrafico; etiqueta: string }[] = [
  { valor: 'tiempo-real', etiqueta: 'En tiempo real' },
  { valor: '24h', etiqueta: '24h' },
  { valor: '7d', etiqueta: '7d' },
  { valor: '30d', etiqueta: '30d' },
  { valor: '6m', etiqueta: '6m' },
  { valor: '1a', etiqueta: '1a' },
]

const HORAS_POR_RANGO: Record<RangoGrafico, number> = { 'tiempo-real': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '6m': 24 * 30 * 6, '1a': 24 * 30 * 12 }

/* Margen para el desfase de reloj entre cliente y servidor: el backend calcula
   su piso de retención con su propio now() al atender el request, así que un
   `desde` que coincide justo con el borde del plan (free en 7 d) puede quedar
   unos milisegundos antes del piso real por pura latencia, no porque falten
   datos. `retencion_dias` null = sin límite (premium, y también admin, que
   está exento). */
const MARGEN_RELOJ_MS = 60_000

export function excedeRetencion(desde: Date, retencionDias: number | null) {
  if (retencionDias === null) return false
  const piso = Date.now() - retencionDias * 86400_000
  return desde.getTime() < piso - MARGEN_RELOJ_MS
}

/* Gate premium de las opciones preset de SelectorVentana (las dos pantallas de
   detalle la usan). "Personalizado" no pasa por acá: no depende del ancho del
   rango sino de permiteRangoPersonalizado. */
export function rangoExcedeRetencion(rango: RangoGrafico, retencionDias: number | null) {
  return excedeRetencion(new Date(Date.now() - HORAS_POR_RANGO[rango] * 3600_000), retencionDias)
}

/* Gate premium del rango de fechas a mano. No hay flag propio en el catálogo:
   `retencion_dias` null es hoy la única marca de "el dueño es premium" que
   viaja en la respuesta del gráfico (free la trae en 7), y sirve igual para el
   admin, que está exento. Si aparece un plan con retención acotada que igual
   permita elegir fechas, esto pasa a ser una columna de `planes` expuesta en
   DatosGraficoOut.
   El zoom del gráfico queda libre a propósito: sólo achica una ventana que ya
   estaba a la vista, mientras que el selector deja saltar a cualquier instante. */
export function permiteRangoPersonalizado(retencionDias: number | null) {
  return retencionDias === null
}

export function duracionMsDeRango(rango: RangoGrafico): number {
  return HORAS_POR_RANGO[rango] * 3600_000
}

/* Bordes del gráfico en ms: el ancho lo da el preset (contra el tic
   compartido, así los sensores no se desalinean) o las fechas elegidas a mano
   / por zoom. Comparte esta cuenta el detalle de dispositivo (una ventana para
   todas las tarjetas); el detalle de sensor arma su propio borde izquierdo
   porque además necesita `desde_efectivo` (el piso real que aplicó el plan). */
export function bordesDeVentana(ventana: Ventana, tic: number): { desdeMs: number; hastaMs: number } {
  if (ventana.tipo === 'fechas') {
    return { desdeMs: ventana.desde.getTime(), hastaMs: ventana.hasta.getTime() }
  }
  return { desdeMs: tic - duracionMsDeRango(ventana.rango), hastaMs: tic }
}

// --------------------------------------------------------------------------
// Ventana: preset o rango de fechas explícito, con la misma resolución para
// ambos casos. Sólo "En tiempo real" pollea (se mueve solo y es el modo
// pensado para ver el sensor moverse); el resto de los presets y cualquier
// rango de fechas explícito (selector o zoom) quedan quietos hasta que el
// usuario pida "Actualizar" — pollearlos era gasto puro, no se movían seguido.
// --------------------------------------------------------------------------

export type Ventana =
  | { tipo: 'preset'; rango: RangoGrafico }
  | { tipo: 'fechas'; desde: Date; hasta: Date }

export function resolverVentana(v: Ventana): { desde: Date; hasta: Date } {
  if (v.tipo === 'fechas') return { desde: v.desde, hasta: v.hasta }
  const hasta = new Date()
  const desde = new Date(hasta.getTime() - HORAS_POR_RANGO[v.rango] * 3600_000)
  return { desde, hasta }
}

export function esTiempoReal(v: Ventana) {
  return v.tipo === 'preset' && v.rango === 'tiempo-real'
}

/* La cadencia del poll es el intervalo de muestreo real del equipo, no una
   constante por rango: pedir más seguido que lo que el equipo reporta sólo
   devuelve la misma foto. `intervaloSeg` llega ya resuelto (plan del dueño
   incluido) desde `DatosGrafico.intervalo_seg`; sin él todavía (primera carga)
   no hay poll hasta que se conozca. */
export function pollDeVentana(v: Ventana, intervaloSeg: number | undefined): number | undefined {
  return esTiempoReal(v) && intervaloSeg ? intervaloSeg * 1000 : undefined
}

/* Estado de ventana con zoom, compartido por las dos pantallas de detalle.
   - elegir: uso manual del selector — pisa la ventana y olvida cualquier zoom
     previo (el usuario salió de ese flujo).
   - zoomear: guarda la ventana actual como "previa" sólo la primera vez (un
     segundo zoom no apila, así "restablecer" siempre vuelve al punto de
     partida y no a un paso intermedio).
   - restablecer: vuelve a la previa; sin una previa guardada no hace nada. */
export function useVentanaConZoom(inicial: Ventana) {
  const [ventana, setVentana] = useState<Ventana>(inicial)
  const [previa, setPrevia] = useState<Ventana | null>(null)

  function elegir(v: Ventana) {
    setPrevia(null)
    setVentana(v)
  }

  function zoomear(desdeMs: number, hastaMs: number) {
    setPrevia((p) => p ?? ventana)
    setVentana({ tipo: 'fechas', desde: new Date(desdeMs), hasta: new Date(hastaMs) })
  }

  function restablecer() {
    if (previa) setVentana(previa)
    setPrevia(null)
  }

  return { ventana, elegir, zoomear, restablecer, hayZoom: previa !== null }
}

export type DetalleDispositivo = {
  dispositivo: DispositivoDetalle
  sensores: SensorConMeta[]
  alertas: AlertaConNotificar[]
}

/* Etiqueta de rol para el detalle de dispositivo (`DispositivoDetalle.rol`):
   'admin' sólo puede salir ahí, nunca de DispositivoConRol (listado del panel). */
export const ETIQUETA_ROL: Record<DispositivoDetalle['rol'], string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Solo lectura',
  admin: 'Administrador',
}

/* Parte estática del detalle: dispositivo, sensores, alertas. No pollea — a
   diferencia del gráfico (useGraficosDeSensores), nada de esto cambia seguido,
   y re-pedirlo en cada tick era la mitad del costo del poll viejo. Se refresca
   sólo al montar y con `refrescar()` (alta/edición/borrado de alertas, cambio
   de intervalo). */
export function useDetalleDispositivo(dispositivoId: string) {
  const cargar = useCallback(
    async (signal: AbortSignal): Promise<DetalleDispositivo> => {
      const [dispositivo, tipos] = await Promise.all([
        obtenerDispositivo(dispositivoId, signal),
        listarTiposSensor(signal),
      ])
      const { sensores, alertas } = await cargarSensoresConMeta(dispositivoId, tipos, signal)
      return { dispositivo, sensores, alertas }
    },
    [dispositivoId],
  )

  return useCarga(cargar)
}

/* Único hook que pollea en el detalle, y sólo pide /grafico por sensor — el
   resto (dispositivo, sensores, alertas) ya salió de useDetalleDispositivo.
   El intervalo de poll se aprende del propio resultado (`intervalo_seg` del
   primer gráfico que vuelve, todos los sensores de un equipo lo comparten):
   arranca sin pollear y se activa apenas se conoce, sin perder la carga en
   curso (useCarga reprograma el tick, no reinicia el ciclo). */
export function useGraficosDeSensores(sensores: SensorConMeta[], ventana: Ventana) {
  const idsKey = sensores.map((s) => s.id).join(',')
  const [intervaloSeg, setIntervaloSeg] = useState<number | undefined>(undefined)

  const cargar = useCallback(
    async (signal: AbortSignal): Promise<Map<string, DatosGrafico | null>> => {
      const ids = idsKey ? idsKey.split(',') : []
      const { desde, hasta } = resolverVentana(ventana)
      const entradas = await Promise.all(
        ids.map(async (id): Promise<[string, DatosGrafico | null]> => {
          try {
            return [id, await obtenerGrafico(id, desde, hasta, signal)]
          } catch {
            // Sensor sin lecturas o fallo puntual: se muestra vacío, no rompe el resto
            return [id, null]
          }
        }),
      )
      return new Map(entradas)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, ventana],
  )

  const { datos, cargando, refrescando, error, errorCrudo, refrescar } = useCarga(cargar, {
    intervaloMs: pollDeVentana(ventana, intervaloSeg),
  })

  useEffect(() => {
    if (!datos) return
    const primero = [...datos.values()].find((d) => d !== null)
    if (primero && primero.intervalo_seg !== intervaloSeg) setIntervaloSeg(primero.intervalo_seg)
  }, [datos, intervaloSeg])

  return {
    porSensor: datos ?? new Map<string, DatosGrafico | null>(),
    intervaloSeg,
    cargando,
    refrescando,
    error,
    errorCrudo,
    refrescar,
  }
}

/* Sin pollear el dispositivo en cada tick, `last_seen_at` no se mueve solo: en
   "En tiempo real" el propio gráfico ya trae lecturas más nuevas que esa foto,
   y sin este máximo el pill de estado se quedaría en "sin reportar" aunque el
   equipo esté al día. Los puntos vienen ordenados por tiempo ascendente
   (medicion_repo.buscar_puntos: `ORDER BY 1`), así que el último de cada serie
   es el más reciente. */
export function ultimoReporteEfectivo(dispositivo: Dispositivo, sensores: SensorConDatos[]): string | null {
  let max = dispositivo.last_seen_at
  for (const sensor of sensores) {
    const puntos = sensor.datos?.puntos
    const ultimo = puntos?.[puntos.length - 1]?.bucket
    if (ultimo && (!max || Date.parse(ultimo) > Date.parse(max))) max = ultimo
  }
  return max
}
