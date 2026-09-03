import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Segmentado } from '@/components/ui/Segmentado'
import { Vacio } from '@/components/ui/Vacio'
import { useHistorial, type FiltroHistorial } from './usarHistorial'
import { medida } from '@/lib/formato'
import { fechaHora } from '@/lib/tiempo'

const OPCIONES_FILAS = [
  { valor: '50', etiqueta: '50' },
  { valor: '100', etiqueta: '100' },
  { valor: '200', etiqueta: '200' },
]

function fechaLocal(valor: string): Date {
  const [y, m, d] = valor.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function finDelDia(fecha: Date): Date {
  const f = new Date(fecha)
  f.setHours(23, 59, 59, 999)
  return f
}

export function BloqueHistorial({ sensorId, unidad }: { sensorId: string; unidad: string }) {
  const [desdeStr, setDesdeStr] = useState('')
  const [hastaStr, setHastaStr] = useState('')
  const [limite, setLimite] = useState(50)

  const filtro: FiltroHistorial = useMemo(
    () => ({
      desde: desdeStr ? fechaLocal(desdeStr) : undefined,
      hasta: hastaStr ? finDelDia(fechaLocal(hastaStr)) : undefined,
      limite,
    }),
    [desdeStr, hastaStr, limite],
  )

  const {
    datos,
    cargando,
    refrescando,
    error,
    pagina,
    hayAnterior,
    haySiguiente,
    anterior,
    siguiente,
  } = useHistorial(sensorId, filtro)

  const finPorRetencion =
    !cargando &&
    !!datos &&
    !datos.cortadaPorFiltro &&
    !haySiguiente &&
    datos.retencionDias !== null

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading font-semibold">Últimas lecturas</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Campo
            id="historial-desde"
            etiqueta="Desde"
            type="date"
            max={hastaStr || undefined}
            value={desdeStr}
            onChange={(e) => setDesdeStr(e.target.value)}
          />
          <Campo
            id="historial-hasta"
            etiqueta="Hasta"
            type="date"
            min={desdeStr || undefined}
            value={hastaStr}
            onChange={(e) => setHastaStr(e.target.value)}
          />
          {(desdeStr || hastaStr) && (
            <Boton
              type="button"
              variante="fantasma"
              onClick={() => {
                setDesdeStr('')
                setHastaStr('')
              }}
            >
              Limpiar
            </Boton>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-label text-danger">
          No pudimos cargar el historial: {error}
        </p>
      )}

      {cargando ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-8 w-full animate-pulse rounded-tile bg-surface-2" />
          <div className="h-8 w-full animate-pulse rounded-tile bg-surface-2" />
          <div className="h-8 w-full animate-pulse rounded-tile bg-surface-2" />
        </div>
      ) : !datos || datos.mediciones.length === 0 ? (
        <Vacio
          titulo="Sin lecturas para mostrar"
          detalle="No hay mediciones en el rango elegido."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-label">
            <thead>
              <tr className="border-b border-border text-note text-text-faint">
                <th className="py-1.5 text-left font-medium">Fecha</th>
                <th className="py-1.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-border ${refrescando ? 'opacity-60' : ''}`}>
              {datos.mediciones.map((m) => (
                <tr key={m.time}>
                  <td className="py-1.5 text-text-muted">{fechaHora(m.time)}</td>
                  <td className="num py-1.5 text-right font-medium text-text">{medida(m.value, unidad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {finPorRetencion && (
        <Card tono="warn" className="flex flex-wrap items-center justify-between gap-3 p-3.5">
          <p className="text-label text-warn">
            Tu plan sólo retiene los últimos {datos!.retencionDias} días de historial.
          </p>
          <Link to="/plan">
            <Boton variante="sutil">Ver planes</Boton>
          </Link>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Boton type="button" variante="fantasma" disabled={!hayAnterior || cargando} onClick={anterior}>
            ← Anterior
          </Boton>
          <span className="text-note text-text-faint">Página {pagina + 1}</span>
          <Boton type="button" variante="fantasma" disabled={!haySiguiente || cargando} onClick={siguiente}>
            Siguiente →
          </Boton>
        </div>
        <Segmentado
          etiqueta="Filas por página"
          valor={String(limite)}
          opciones={OPCIONES_FILAS}
          onCambiar={(v) => setLimite(Number(v))}
        />
      </div>
    </Card>
  )
}
