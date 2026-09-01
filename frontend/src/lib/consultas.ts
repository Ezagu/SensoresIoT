import { api } from './api'
import type {
  AlertaConNotificar,
  DatosGrafico,
  Dispositivo,
  Sensor,
  TipoSensor,
} from './tipos'

/* Envoltorios tipados de la API. Nada de estado ni de React acá: sólo la URL,
   el tipo de vuelta y la señal de cancelación. */

export function listarDispositivos(usuarioId: string, signal?: AbortSignal) {
  return api
    .get<Dispositivo[]>(`/usuarios/${usuarioId}/dispositivos`, { signal })
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
    .get<AlertaConNotificar[]>(`/dispositivos/${dispositivoId}/alertas`, { signal })
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
