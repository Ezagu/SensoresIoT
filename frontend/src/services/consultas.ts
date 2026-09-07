import { api } from '@/services/api'
import type {
  AccesoCreatePayload,
  AccesoDispositivo,
  AccesoUpdatePayload,
  Alerta,
  AlertaConNotificar,
  AlertaCreatePayload,
  AlertaUpdatePayload,
  DatosGrafico,
  DispositivoDetalle,
  DispositivoUpdatePayload,
  Historial,
  IntervaloActualizado,
  PanelResumen,
  PreferenciaUpdatePayload,
  Sensor,
  TipoSensor,
} from '@/tipos'

/* Envoltorios tipados de la API. Nada de estado ni de React acá: sólo la URL,
   el tipo de vuelta y la señal de cancelación. */

export function obtenerDispositivo(dispositivoId: string, signal?: AbortSignal) {
  return api.get<DispositivoDetalle>(`/dispositivos/${dispositivoId}`, { signal }).then((r) => r.data)
}

/* Todos los dispositivos del usuario con sensores + última lectura + alertas
   disparadas, resuelto en un solo request. */
export function obtenerPanel(usuarioId: string, signal?: AbortSignal) {
  return api.get<PanelResumen>(`/usuarios/${usuarioId}/panel`, { signal }).then((r) => r.data)
}

export function listarTiposSensor(signal?: AbortSignal) {
  return api.get<TipoSensor[]>('/tipos-sensor/', { signal }).then((r) => r.data)
}

export function listarSensores(dispositivoId: string, signal?: AbortSignal) {
  return api
    .get<Sensor[]>(`/dispositivos/${dispositivoId}/sensores`, { signal })
    .then((r) => r.data)
}

/* Listar no está gateado por plan (sí lo está crear): un usuario free devuelve
   lista vacía, no 403. */
export function listarAlertas(dispositivoId: string, signal?: AbortSignal) {
  return api
    .get<AlertaConNotificar[]>(`/dispositivos/${dispositivoId}/alertas`, { signal })
    .then((r) => r.data)
}

/* POST/PATCH devuelven AlertaOut, sin `notificar` (eso sólo lo agrega el
   listado por dispositivo, resuelto para quien lo pide). */
export function crearAlerta(payload: AlertaCreatePayload) {
  return api.post<Alerta>('/alertas/', payload).then((r) => r.data)
}

export function actualizarAlerta(alertaId: string, payload: AlertaUpdatePayload) {
  return api.patch<Alerta>(`/alertas/${alertaId}`, payload).then((r) => r.data)
}

export function eliminarAlerta(alertaId: string) {
  return api.delete(`/alertas/${alertaId}`)
}

export function actualizarPreferenciaAlerta(alertaId: string, payload: PreferenciaUpdatePayload) {
  return api.put(`/alertas/${alertaId}/notificacion`, payload)
}

export function obtenerGrafico(sensorId: string, desde: Date, hasta: Date, signal?: AbortSignal) {
  return api
    .get<DatosGrafico>(`/sensores/${sensorId}/grafico`, {
      signal,
      params: { desde: desde.toISOString(), hasta: hasta.toISOString() },
    })
    .then((r) => r.data)
}

export function obtenerHistorial(
  sensorId: string,
  params: { limite?: number; cursor?: string; hasta?: Date } = {},
  signal?: AbortSignal,
) {
  return api
    .get<Historial>(`/sensores/${sensorId}/historial`, {
      signal,
      params: {
        limite: params.limite,
        cursor: params.cursor,
        hasta: params.hasta?.toISOString(),
      },
    })
    .then((r) => r.data)
}

export function configurarIntervalo(dispositivoId: string, intervaloSeg: number | null) {
  return api
    .patch<IntervaloActualizado>(`/dispositivos/${dispositivoId}/intervalo`, {
      intervalo_seg: intervaloSeg,
    })
    .then((r) => r.data)
}

export function actualizarDispositivo(dispositivoId: string, payload: DispositivoUpdatePayload) {
  return api.patch<DispositivoDetalle>(`/dispositivos/${dispositivoId}`, payload).then((r) => r.data)
}

/* /accesos y no /usuarios: no colisiona con el router de usuarios existente. */
export function listarAccesos(dispositivoId: string, signal?: AbortSignal) {
  return api.get<AccesoDispositivo[]>(`/dispositivos/${dispositivoId}/accesos`, { signal }).then((r) => r.data)
}

export function invitarAcceso(dispositivoId: string, payload: AccesoCreatePayload) {
  return api.post<AccesoDispositivo>(`/dispositivos/${dispositivoId}/accesos`, payload).then((r) => r.data)
}

export function actualizarAcceso(dispositivoId: string, usuarioId: string, payload: AccesoUpdatePayload) {
  return api
    .patch<AccesoDispositivo>(`/dispositivos/${dispositivoId}/accesos/${usuarioId}`, payload)
    .then((r) => r.data)
}

export function quitarAcceso(dispositivoId: string, usuarioId: string) {
  return api.delete(`/dispositivos/${dispositivoId}/accesos/${usuarioId}`)
}

export type ParametrosExport = {
  desde?: Date
  hasta?: Date
  intervaloSeg?: number
  excel?: boolean
}

export type ResultadoExport = {
  archivo: Blob
  nombreArchivo: string
  resolucion: string
  fuente: string
  desdeEfectivo: string
  recortado: boolean
  retencionDias: number | null
  intervaloSeg: number | null
}

/* Content-Disposition y los X-* están en expose_headers (main.py) para que este
   fetch pueda leerlos: una navegación <a href> no llevaría el Authorization. */
export async function exportarHistorial(
  dispositivoId: string,
  { desde, hasta, intervaloSeg, excel }: ParametrosExport,
): Promise<ResultadoExport> {
  const respuesta = await api.get(`/dispositivos/${dispositivoId}/exportar`, {
    responseType: 'blob',
    params: {
      desde: desde?.toISOString(),
      hasta: hasta?.toISOString(),
      intervalo_seg: intervaloSeg,
      excel: excel || undefined,
    },
  })

  const disposition = String(respuesta.headers['content-disposition'] ?? '')
  const nombreArchivo = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'export.csv'
  const retencion = respuesta.headers['x-retencion-dias']
  const intervalo = respuesta.headers['x-intervalo-seg']

  return {
    archivo: respuesta.data as Blob,
    nombreArchivo,
    resolucion: String(respuesta.headers['x-resolucion'] ?? ''),
    fuente: String(respuesta.headers['x-fuente'] ?? ''),
    desdeEfectivo: String(respuesta.headers['x-desde-efectivo'] ?? ''),
    recortado: respuesta.headers['x-recortado'] === 'true',
    retencionDias: retencion !== undefined ? Number(retencion) : null,
    intervaloSeg: intervalo !== undefined ? Number(intervalo) : null,
  }
}
