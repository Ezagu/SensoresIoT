import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ProveedorSesion, useSesion } from '@/lib/auth'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/features/auth/Login'
import { Registro } from '@/features/auth/Registro'
import { Verificar } from '@/features/auth/Verificar'
import { Panel } from '@/features/panel/Panel'
import { Dispositivos } from '@/features/dispositivo/Dispositivos'
import { Vincular } from '@/features/dispositivo/Vincular'
import { Alertas } from '@/features/alertas/Alertas'
import { PlanPagina } from '@/features/plan/PlanPagina'
import { Ajustes } from '@/features/cuenta/Ajustes'
import { Cuenta } from '@/features/cuenta/Cuenta'

/* Recharts pesa ~100 kB gz y sólo lo usa esta pantalla: el panel y el resto de
   la app no tienen por qué cargarlo. */
const DetalleDispositivo = lazy(() =>
  import('@/features/dispositivo/DetalleDispositivo').then((m) => ({ default: m.DetalleDispositivo })),
)

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
            <Route element={<Layout titulo="Dispositivos" />}>
              <Route path="/dispositivos" element={<Dispositivos />} />
              <Route
                path="/dispositivos/:id"
                element={
                  <Suspense fallback={<div className="grid min-h-40 place-items-center text-text-faint">Cargando…</div>}>
                    <DetalleDispositivo />
                  </Suspense>
                }
              />
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
            <Route element={<Layout titulo="Mi cuenta" />}>
              <Route path="/cuenta" element={<Cuenta />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProveedorSesion>
    </BrowserRouter>
  )
}
