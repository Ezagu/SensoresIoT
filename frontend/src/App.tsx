import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ProveedorSesion, useSesion } from '@/features/auth/sesion'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/features/auth/Login'
import { Registro } from '@/features/auth/Registro'
import { Verificar } from '@/features/auth/Verificar'
import { Panel } from '@/features/panel/Panel'
import { Dispositivos } from '@/features/dispositivo/Dispositivos'
import { Vincular } from '@/features/dispositivo/Vincular'
import { AjustesDispositivo } from '@/features/dispositivo/ajustes/AjustesDispositivo'
import { Alertas } from '@/features/alertas/Alertas'
import { PlanPagina } from '@/features/plan/PlanPagina'
import { Ajustes } from '@/features/cuenta/Ajustes'

/* Recharts pesa ~100 kB gz y sólo la usan estas pantallas: el panel y el resto
   de la app no tienen por qué cargarlo. */
const DetalleDispositivo = lazy(() =>
  import('@/features/dispositivo/DetalleDispositivo').then((m) => ({ default: m.DetalleDispositivo })),
)
const DetalleSensor = lazy(() =>
  import('@/features/dispositivo/DetalleSensor').then((m) => ({ default: m.DetalleSensor })),
)

function Cargando({ alto = 'min-h-dvh' }: { alto?: string }) {
  return <div className={`grid ${alto} place-items-center text-text-faint`}>Cargando…</div>
}

function Guardia() {
  const { estado } = useSesion()
  const location = useLocation()

  if (estado === 'cargando') return <Cargando />
  if (estado === 'fuera') {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  }
  return <Outlet />
}

function SoloAnonimo() {
  const { estado } = useSesion()
  if (estado === 'cargando') return <Cargando />
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
                  <Suspense fallback={<Cargando alto="min-h-40" />}>
                    <DetalleDispositivo />
                  </Suspense>
                }
              />
              <Route
                path="/dispositivos/:id/sensores/:sensorId"
                element={
                  <Suspense fallback={<Cargando alto="min-h-40" />}>
                    <DetalleSensor />
                  </Suspense>
                }
              />
              <Route path="/dispositivos/:id/ajustes" element={<AjustesDispositivo />} />
              <Route path="/vincular" element={<Vincular />} />
            </Route>
            <Route element={<Layout titulo="Avisos" />}>
              <Route path="/avisos" element={<Alertas />} />
            </Route>
            <Route element={<Layout titulo="Plan" />}>
              <Route path="/plan" element={<PlanPagina />} />
            </Route>
            <Route element={<Layout titulo="Ajustes" />}>
              <Route path="/ajustes" element={<Ajustes />} />
            </Route>
            {/* Perfil, plan y preferencias viven todos en /ajustes: dos puertas
                a lo mismo obligaban a adivinar en cuál estaba cada cosa. */}
            <Route path="/cuenta" element={<Navigate to="/ajustes" replace />} />
            {/* "Alerta" es la regla y "aviso" el evento: acá sólo se miran los
                segundos. Renombrada antes de que los mails linkeen la URL. */}
            <Route path="/alertas" element={<Navigate to="/avisos" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProveedorSesion>
    </BrowserRouter>
  )
}
