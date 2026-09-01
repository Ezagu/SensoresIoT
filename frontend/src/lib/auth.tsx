import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, onSesionExpirada, setAccessToken } from './api'
import type { MiPlan, SesionActual } from './tipos'

type Estado = 'cargando' | 'dentro' | 'fuera'

type Contexto = {
  estado: Estado
  sesion: SesionActual | null
  /* null mientras carga o si /planes/mi-plan falló: el plan no es condición
     para tener sesión, así que un error ahí no puede desloguear. */
  plan: MiPlan | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<Contexto | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [sesion, setSesion] = useState<SesionActual | null>(null)
  const [plan, setPlan] = useState<MiPlan | null>(null)

  const cerrarLocal = useCallback(() => {
    setAccessToken(null)
    setSesion(null)
    setPlan(null)
    setEstado('fuera')
  }, [])

  useEffect(() => {
    onSesionExpirada(cerrarLocal)
  }, [cerrarLocal])

  const cargarUsuario = useCallback(async () => {
    const me = await api.get<SesionActual>('/auth/me')
    // El plan va aparte y sin bloquear: lo consume la sidebar y la página de
    // plan, pero la sesión vale igual si esa request falla.
    api
      .get<MiPlan>('/planes/mi-plan')
      .then((r) => setPlan(r.data))
      .catch(() => setPlan(null))
    return me.data
  }, [])

  /* Al montar no hay access token en memoria (no se persiste a propósito), pero
     sí puede haber cookie de refresh viva: se intenta rehidratar la sesión. */
  useEffect(() => {
    let vigente = true
    ;(async () => {
      try {
        const { data } = await api.post<{ access_token: string }>('/auth/refresh')
        setAccessToken(data.access_token)
        const usuario = await cargarUsuario()
        if (!vigente) return
        setSesion(usuario)
        setEstado('dentro')
      } catch {
        if (vigente) cerrarLocal()
      }
    })()
    return () => {
      vigente = false
    }
  }, [cerrarLocal, cargarUsuario])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ access_token: string }>('/auth/login', { email, password })
      setAccessToken(data.access_token)
      setSesion(await cargarUsuario())
      setEstado('dentro')
    },
    [cargarUsuario],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      cerrarLocal()
    }
  }, [cerrarLocal])

  const valor = useMemo(
    () => ({ estado, sesion, plan, login, logout }),
    [estado, sesion, plan, login, logout],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSesion tiene que usarse dentro de ProveedorSesion')
  return ctx
}
