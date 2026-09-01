import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, onSesionExpirada, setAccessToken } from './api'
import type { SesionActual } from './tipos'

type Estado = 'cargando' | 'dentro' | 'fuera'

type Contexto = {
  estado: Estado
  sesion: SesionActual | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<Contexto | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [sesion, setSesion] = useState<SesionActual | null>(null)

  const cerrarLocal = useCallback(() => {
    setAccessToken(null)
    setSesion(null)
    setEstado('fuera')
  }, [])

  useEffect(() => {
    onSesionExpirada(cerrarLocal)
  }, [cerrarLocal])

  /* Al montar no hay access token en memoria (no se persiste a propósito), pero
     sí puede haber cookie de refresh viva: se intenta rehidratar la sesión. */
  useEffect(() => {
    let vigente = true
    ;(async () => {
      try {
        const { data } = await api.post<{ access_token: string }>('/auth/refresh')
        setAccessToken(data.access_token)
        const me = await api.get<SesionActual>('/auth/me')
        if (!vigente) return
        setSesion(me.data)
        setEstado('dentro')
      } catch {
        if (vigente) cerrarLocal()
      }
    })()
    return () => {
      vigente = false
    }
  }, [cerrarLocal])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ access_token: string }>('/auth/login', { email, password })
    setAccessToken(data.access_token)
    const me = await api.get<SesionActual>('/auth/me')
    setSesion(me.data)
    setEstado('dentro')
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      cerrarLocal()
    }
  }, [cerrarLocal])

  const valor = useMemo(() => ({ estado, sesion, login, logout }), [estado, sesion, login, logout])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSesion tiene que usarse dentro de ProveedorSesion')
  return ctx
}
