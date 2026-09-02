import { Campo } from '@/components/ui/Campo'
import { Segmentado } from '@/components/ui/Segmentado'
import { RANGOS, type RangoGrafico, type Ventana } from '@/lib/dispositivos'

type Opcion = RangoGrafico | 'personalizado'

const OPCIONES: { valor: Opcion; etiqueta: string }[] = [
  ...RANGOS,
  { valor: 'personalizado', etiqueta: 'Personalizado' },
]

/* `<input type="date">` parsea 'YYYY-MM-DD' como medianoche UTC si se le pasa
   directo a `new Date(...)`: se arma en local a mano para que el rango
   corresponda al día que el usuario ve en el calendario. */
function fechaLocalDesde(valor: string): Date {
  const [y, m, d] = valor.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function finDelDia(fecha: Date): Date {
  const f = new Date(fecha)
  f.setHours(23, 59, 59, 999)
  return f
}

function aInputDate(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function SelectorVentana({
  ventana,
  onCambiar,
}: {
  ventana: Ventana
  onCambiar: (v: Ventana) => void
}) {
  const opcion: Opcion = ventana.tipo === 'preset' ? ventana.rango : 'personalizado'
  const hoy = aInputDate(new Date())
  const desdeStr = ventana.tipo === 'fechas' ? aInputDate(ventana.desde) : ''
  const hastaStr = ventana.tipo === 'fechas' ? aInputDate(ventana.hasta) : hoy

  function elegir(valor: Opcion) {
    if (valor === 'personalizado') {
      const hasta = new Date()
      const desde = new Date(hasta.getTime() - 24 * 3600_000)
      onCambiar({ tipo: 'fechas', desde, hasta })
      return
    }
    onCambiar({ tipo: 'preset', rango: valor })
  }

  function cambiarDesde(valor: string) {
    if (!valor) return
    const hasta = ventana.tipo === 'fechas' ? ventana.hasta : new Date()
    onCambiar({ tipo: 'fechas', desde: fechaLocalDesde(valor), hasta })
  }

  function cambiarHasta(valor: string) {
    if (!valor) return
    const desde = ventana.tipo === 'fechas' ? ventana.desde : fechaLocalDesde(valor)
    onCambiar({ tipo: 'fechas', desde, hasta: finDelDia(fechaLocalDesde(valor)) })
  }

  const rangoInvalido =
    ventana.tipo === 'fechas' && ventana.desde.getTime() >= ventana.hasta.getTime()

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Segmentado etiqueta="Rango del gráfico" valor={opcion} opciones={OPCIONES} onCambiar={elegir} />
      {opcion === 'personalizado' && (
        <div className="flex flex-wrap gap-2">
          <Campo
            id="ventana-desde"
            etiqueta="Desde"
            type="date"
            max={hastaStr}
            value={desdeStr}
            onChange={(e) => cambiarDesde(e.target.value)}
          />
          <Campo
            id="ventana-hasta"
            etiqueta="Hasta"
            type="date"
            max={hoy}
            value={hastaStr}
            onChange={(e) => cambiarHasta(e.target.value)}
          />
          {rangoInvalido && (
            <p role="alert" className="text-label text-danger">
              "Desde" tiene que ser anterior a "hasta".
            </p>
          )}
        </div>
      )}
    </div>
  )
}
