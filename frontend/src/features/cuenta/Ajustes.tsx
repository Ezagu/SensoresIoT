import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { useTema, type Tema } from '@/lib/tema'
import { useSesion } from '@/lib/auth'

const OPCIONES: { valor: Tema; etiqueta: string }[] = [
  { valor: 'sistema', etiqueta: 'Sistema' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
]

export function Ajustes() {
  const { tema, cambiarTema } = useTema()
  const { logout } = useSesion()

  return (
    <div className="flex max-w-[560px] flex-col gap-3">
      <Card className="p-4">
        <h2 className="text-[14px]">Apariencia</h2>
        <p className="mt-1 mb-3 text-[12px] text-text-faint">
          Sin elección propia se usa el tema del sistema.
        </p>
        <div
          role="group"
          aria-label="Tema"
          className="inline-flex gap-0.5 rounded-[8px] border border-border bg-surface-2 p-0.5"
        >
          {OPCIONES.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              onClick={() => cambiarTema(valor)}
              aria-pressed={tema === valor}
              className={`min-h-8 rounded-[6px] px-3 text-[12px] font-medium transition-colors duration-150 ${
                tema === valor ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[14px]">Sesión</h2>
        <p className="mt-1 mb-3 text-[12px] text-text-faint">
          Cerrar sesión sólo afecta a este dispositivo.
        </p>
        <Boton variante="fantasma" onClick={() => void logout()}>
          Cerrar sesión
        </Boton>
      </Card>
    </div>
  )
}
