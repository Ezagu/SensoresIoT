import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

/* En dev pega contra el proxy de Vite (/api -> :8000) para quedar same-origin:
   la cookie de refresh es httponly + samesite, así que cross-origin no viaja. */
const BASE = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({
  baseURL: BASE,
  withCredentials: true, // la cookie refresh_token
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

/* Un solo refresh en vuelo: si expiran varias requests a la vez, todas esperan
   el mismo POST /auth/refresh en lugar de dispararlo N veces (y rotar el token
   N veces, invalidándose entre sí). */
let refreshEnVuelo: Promise<string> | null = null
let alExpirar: (() => void) | null = null

export function onSesionExpirada(cb: () => void) {
  alExpirar = cb
}

async function refrescar(): Promise<string> {
  if (!refreshEnVuelo) {
    refreshEnVuelo = api
      .post<{ access_token: string }>('/auth/refresh')
      .then((r) => {
        setAccessToken(r.data.access_token)
        return r.data.access_token
      })
      .finally(() => {
        refreshEnVuelo = null
      })
  }
  return refreshEnVuelo
}

type ConfigReintento = AxiosRequestConfig & { _reintentado?: boolean }

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as ConfigReintento | undefined
    const esAuth = original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/login')

    // Todo fallo de credencial de usuario es 401, así que alcanza con este caso.
    if (error.response?.status === 401 && original && !original._reintentado && !esAuth) {
      original._reintentado = true
      try {
        await refrescar()
        return api(original)
      } catch {
        setAccessToken(null)
        alExpirar?.()
      }
    }
    return Promise.reject(error)
  },
)

/* El backend manda los errores como {"detail": "..."} */
export function mensajeDeError(error: unknown, porDefecto = 'Algo falló. Probá de nuevo.'): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'No se pudo conectar con el servidor.'
  }
  return porDefecto
}

export function estadoHttp(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

/* Con `responseType: 'blob'` (export CSV) el cuerpo de un error también llega
   como Blob: mensajeDeError no encuentra `detail` ahí y devuelve el texto por
   default. El endpoint tiene rate limit (20/hora), así que perder el mensaje
   real hace indistinguible un 429 de un fallo genérico. */
export async function mensajeDeErrorBlob(
  error: unknown,
  porDefecto = 'Algo falló. Probá de nuevo.',
): Promise<string> {
  if (!axios.isAxiosError(error)) return porDefecto
  if (!error.response) return 'No se pudo conectar con el servidor.'

  const datos = error.response.data as unknown
  if (!(datos instanceof Blob)) return mensajeDeError(error, porDefecto)

  try {
    const texto = await datos.text()
    const detail = (JSON.parse(texto) as { detail?: unknown })?.detail
    return typeof detail === 'string' ? detail : porDefecto
  } catch {
    return porDefecto
  }
}

/* El 429 del lockout de login no viene de slowapi sino del service, y se
   distingue sólo por el texto — el de slowapi es un rate limit por IP. */
export function esCuentaBloqueada(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 429 &&
    typeof error.response.data?.detail === 'string' &&
    error.response.data.detail.includes('bloqueada')
  )
}
