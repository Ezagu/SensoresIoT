import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ProveedorSesion, useSesion } from '@/lib/auth'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/features/auth/Login'
import { Registro } from '@/features/auth/Registro'
import { Verificar } from '@/features/auth/Verificar'
import { Panel } from '@/features/panel/Panel'
import { Equipos } from '@/features/dispositivo/Equipos'
import { DetalleEquipo } from '@/features/dispositivo/DetalleEquipo'
import { Vincular } from '@/features/dispositivo/Vincular'
import { Alertas } from '@/features/alertas/Alertas'
import { PlanPagina } from '@/features/plan/PlanPagina'
import { Ajustes } from '@/features/cuenta/Ajustes'

function Guardia() {
  const { estado } = useSesion()
  const location = useLocation()

  if (estado === 'cargando') {
    return (
      <div className="grid min-h-dvh place-items-center text-text-faint">Cargando…</div>
    )
  }
  if (estado === 'fuera') {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  }
  return <Outlet />
}

function SoloAnonimo() {
  const { estado } = useSesion()
  if (estado === 'cargando') {
    return <div className="grid min-h-dvh place-items-center text-text-faint">Cargando…</div>
  }
  return estado === 'dentro' ? <Navigate to="/" replace /> : <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Routes>
          <Route element={<SoloAnonimo />}>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/verificar" element={<Verificar />} />
          </Route>

          <Route element={<Guardia />}>
            <Route element={<Layout titulo="Panel" />}>
              <Route index element={<Panel />} />
            </Route>
            <Route element={<Layout titulo="Equipos" />}>
              <Route path="/equipos" element={<Equipos />} />
              <Route path="/equipos/:id" element={<DetalleEquipo />} />
              <Route path="/vincular" element={<Vincular />} />
            </Route>
            <Route element={<Layout titulo="Alertas" />}>
              <Route path="/alertas" element={<Alertas />} />
            </Route>
            <Route element={<Layout titulo="Plan" />}>
              <Route path="/plan" element={<PlanPagina />} />
            </Route>
            <Route element={<Layout titulo="Ajustes" />}>
              <Route path="/ajustes" element={<Ajustes />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProveedorSesion>
    </BrowserRouter>
  )
}
