import { useNavigate } from 'react-router-dom'
import { Campo } from '@/components/ui/Campo'
import { Segmentado } from '@/components/ui/Segmentado'
import { RANGOS, type RangoGrafico, type Ventana } from '@/lib/ventana'
import { permiteRangoPersonalizado, rangoExcedeRetencion } from '@/lib/retencion'

type Opcion = RangoGrafico | 'personalizado'

const OPCIONES: { valor: Opcion; etiqueta: string }[] = [
  ...RANGOS,
  { valor: 'personalizado', etiqueta: 'Personalizado' },
]

/* `<input type="datetime-local">` trabaja en hora local y sin zona: se parsea y
   se formatea a mano para que el rango sea exactamente el que muestra el campo,
   en vez de depender de cómo interprete `new Date(...)` una cadena sin zona. */
function fechaLocalDesde(valor: string): Date {
  const [dia, hora] = valor.split('T')
  const [y, m, d] = dia.split('-').map(Number)
  const [hh, mm] = hora.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

function aInputLocal(fecha: Date): string {
  const dd = (n: number) => String(n).padStart(2, '0')
  const dia = `${fecha.getFullYear()}-${dd(fecha.getMonth() + 1)}-${dd(fecha.getDate())}`
  return `${dia}T${dd(fecha.getHours())}:${dd(fecha.getMinutes())}`
}

/* Los campos tienen precisión de minuto: el default arranca redondeado para que
   lo que se pide sea lo mismo que muestran. */
function ahoraAlMinuto(): Date {
  const f = new Date()
  f.setSeconds(0, 0)
  return f
}

export function SelectorVentana({
  ventana,
  onCambiar,
  retencionDias,
}: {
  ventana: Ventana
  onCambiar: (v: Ventana) => void
  retencionDias: number | null
}) {
  const navigate = useNavigate()
  const permitePersonalizado = permiteRangoPersonalizado(retencionDias)
  const opcion: Opcion = ventana.tipo === 'preset' ? ventana.rango : 'personalizado'
  const ahora = aInputLocal(ahoraAlMinuto())
  const desdeStr = ventana.tipo === 'fechas' ? aInputLocal(ventana.desde) : ''
  const hastaStr = ventana.tipo === 'fechas' ? aInputLocal(ventana.hasta) : ahora

  function elegir(valor: Opcion) {
    if (valor === 'personalizado') {
      const hasta = ahoraAlMinuto()
      const desde = new Date(hasta.getTime() - 24 * 3600_000)
      onCambiar({ tipo: 'fechas', desde, hasta })
      return
    }
    onCambiar({ tipo: 'preset', rango: valor })
  }

  function cambiarDesde(valor: string) {
    if (!valor) return
    const hasta = ventana.tipo === 'fechas' ? ventana.hasta : ahoraAlMinuto()
    onCambiar({ tipo: 'fechas', desde: fechaLocalDesde(valor), hasta })
  }

  function cambiarHasta(valor: string) {
    if (!valor) return
    const hasta = fechaLocalDesde(valor)
    const desde = ventana.tipo === 'fechas' ? ventana.desde : hasta
    onCambiar({ tipo: 'fechas', desde, hasta })
  }

  const rangoInvalido =
    ventana.tipo === 'fechas' && ventana.desde.getTime() >= ventana.hasta.getTime()

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Segmentado
        etiqueta="Rango del gráfico"
        valor={opcion}
        opciones={OPCIONES}
        onCambiar={elegir}
        bloqueada={(v) =>
          v === 'personalizado' ? !permitePersonalizado : rangoExcedeRetencion(v, retencionDias)
        }
        onBloqueada={() => navigate('/plan')}
      />
      {/* Sin plan que lo habilite los campos no se montan ni siquiera con la
          ventana en 'fechas': el zoom del gráfico deja ese estado a cualquiera,
          y mostrarlos sería la misma función premium por otra puerta. */}
      {opcion === 'personalizado' && permitePersonalizado && (
        <div className="flex flex-wrap gap-2">
          <Campo
            id="ventana-desde"
            etiqueta="Desde"
            type="datetime-local"
            max={hastaStr}
            value={desdeStr}
            onChange={(e) => cambiarDesde(e.target.value)}
          />
          <Campo
            id="ventana-hasta"
            etiqueta="Hasta"
            type="datetime-local"
            max={ahora}
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
