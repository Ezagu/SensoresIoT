import { api } from '@/services/api'
import type {
  AccesoDispositivo,
  AccesoUpdatePayload,
  Alerta,
  AlertaCreatePayload,
  AlertaUpdatePayload,
  EventosAlerta,
  DatosGrafico,
  DispositivoDetalle,
  DispositivoEstado,
  DispositivoInventario,
  DispositivoUpdatePayload,
  Historial,
  IntervaloActualizado,
  Invitacion,
  InvitacionCreatePayload,
  NotificacionUpdatePayload,
  PanelResumen,
  PasswordUpdatePayload,
  PerfilUpdatePayload,
  PreferenciasNotificacion,
  PreferenciasUpdatePayload,
  Sensor,
  SesionActual,
  TipoSensor,
} from '@/tipos'

/* Envoltorios tipados de la API. Nada de estado ni de React acá: sólo la URL,
   el tipo de vuelta y la señal de cancelación. */

export function obtenerDispositivo(dispositivoId: string, signal?: AbortSignal) {
  return api.get<DispositivoDetalle>(`/dispositivos/${dispositivoId}`, { signal }).then((r) => r.data)
}

export function obtenerEstadoDispositivo(dispositivoId: string, signal?: AbortSignal) {
  return api.get<DispositivoEstado>(`/dispositivos/${dispositivoId}/estado`, { signal }).then((r) => r.data)
}

/* Todos los dispositivos del usuario con sensores + última lectura + alertas
   disparadas, resuelto en un solo request. */
export function obtenerPanel(usuarioId: string, signal?: AbortSignal) {
  return api.get<PanelResumen>(`/usuarios/${usuarioId}/panel`, { signal }).then((r) => r.data)
}

/* Todos los dispositivos del usuario como equipos, no como datos: sin
   lecturas, para /dispositivos (inventario). Pendiente de enriquecer en el
   backend (sensores, alertas, accesos) — ver plan de la pantalla. */
export function listarDispositivos(usuarioId: string, signal?: AbortSignal) {
  return api
    .get<DispositivoInventario[]>(`/usuarios/${usuarioId}/dispositivos`, { signal })
    .then((r) => r.data)
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
    .get<Alerta[]>(`/dispositivos/${dispositivoId}/alertas`, { signal })
    .then((r) => r.data)
}

export function crearAlerta(payload: AlertaCreatePayload) {
  return api.post<Alerta>('/alertas/', payload).then((r) => r.data)
}

export function actualizarAlerta(alertaId: string, payload: AlertaUpdatePayload) {
  return api.patch<Alerta>(`/alertas/${alertaId}`, payload).then((r) => r.data)
}

export function eliminarAlerta(alertaId: string) {
  return api.delete(`/alertas/${alertaId}`)
}

/* Log global: transiciones de las reglas de todos los equipos a los que el
   usuario llega, sin importar el rol. Paginado por cursor hacia atrás. */
export function listarEventosAlerta(
  params: { cursor?: string; limite?: number } = {},
  signal?: AbortSignal,
) {
  return api
    .get<EventosAlerta>('/alertas/eventos', { signal, params })
    .then((r) => r.data)
}

/* Opt-out de mails del equipo entero, del usuario que llama. */
export function configurarNotificaciones(dispositivoId: string, payload: NotificacionUpdatePayload) {
  return api
    .put<NotificacionUpdatePayload>(`/dispositivos/${dispositivoId}/notificaciones`, payload)
    .then((r) => r.data)
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

export function actualizarAcceso(dispositivoId: string, usuarioId: string, payload: AccesoUpdatePayload) {
  return api
    .patch<AccesoDispositivo>(`/dispositivos/${dispositivoId}/accesos/${usuarioId}`, payload)
    .then((r) => r.data)
}

export function quitarAcceso(dispositivoId: string, usuarioId: string) {
  return api.delete(`/dispositivos/${dispositivoId}/accesos/${usuarioId}`)
}

export function listarInvitaciones(dispositivoId: string, signal?: AbortSignal) {
  return api.get<Invitacion[]>(`/dispositivos/${dispositivoId}/invitaciones`, { signal }).then((r) => r.data)
}

export function crearInvitacion(dispositivoId: string, payload: InvitacionCreatePayload) {
  return api.post<Invitacion>(`/dispositivos/${dispositivoId}/invitaciones`, payload).then((r) => r.data)
}

export function regenerarInvitacion(dispositivoId: string, invitacionId: string) {
  return api
    .post<Invitacion>(`/dispositivos/${dispositivoId}/invitaciones/${invitacionId}/regenerate`)
    .then((r) => r.data)
}

export function eliminarInvitacion(dispositivoId: string, invitacionId: string) {
  return api.delete(`/dispositivos/${dispositivoId}/invitaciones/${invitacionId}`)
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

/* ——— Cuenta ———
   Los cuatro primeros TODAVÍA NO EXISTEN en el backend: son el contrato que
   espera la pantalla de ajustes. Hasta que estén, cada uno responde 404 y la
   sección muestra el error real en vez de fingir que guardó. */

export function obtenerPreferencias(signal?: AbortSignal) {
  return api.get<PreferenciasNotificacion>('/auth/me/preferencias', { signal }).then((r) => r.data)
}

export function actualizarPreferencias(payload: PreferenciasUpdatePayload) {
  return api.patch<PreferenciasNotificacion>('/auth/me/preferencias', payload).then((r) => r.data)
}

export function actualizarPerfil(payload: PerfilUpdatePayload) {
  return api.patch<SesionActual>('/auth/me', payload).then((r) => r.data)
}

export function cambiarPassword(payload: PasswordUpdatePayload) {
  return api.put('/auth/me/password', payload)
}

/* Este sí existe. Borra todos los refresh token del usuario, el de esta pestaña
   incluido: después hay que cerrar la sesión local igual. */
export function cerrarSesionGlobal() {
  return api.post('/auth/global-logout')
}
