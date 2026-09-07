import { Card } from '@/components/ui/Card'
import { Boton } from '@/components/ui/Boton'
import { Segmentado } from '@/components/ui/Segmentado'
import { useTema, type Tema } from '@/hooks/usarTema'
import { useSesion } from '@/features/auth/sesion'

const OPCIONES: { valor: Tema; etiqueta: string }[] = [
  { valor: 'sistema', etiqueta: 'Sistema' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
]

export function Ajustes() {
  const { tema, cambiarTema } = useTema()
  const { logout } = useSesion()

  return (
    <div className="flex max-w-140 flex-col gap-3">
      <Card className="p-4">
        <h2 className="text-heading">Apariencia</h2>
        <p className="mt-1 mb-3 text-label text-text-faint">
          Sin elección propia se usa el tema del sistema.
        </p>
        <Segmentado valor={tema} opciones={OPCIONES} onCambiar={cambiarTema} etiqueta="Tema" />
      </Card>

      <Card className="p-4">
        <h2 className="text-heading">Sesión</h2>
        <p className="mt-1 mb-3 text-label text-text-faint">
          Cerrar sesión sólo afecta a este dispositivo.
        </p>
        <Boton className='hover:bg-danger-soft' variante="fantasma" onClick={() => void logout()} >
          Cerrar sesión
        </Boton>
      </Card>
    </div>
  )
}
