import { Segmentado } from '@/components/ui/Segmentado'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { useTema, type Tema } from '@/hooks/usarTema'

const OPCIONES: { valor: Tema; etiqueta: string }[] = [
  { valor: 'sistema', etiqueta: 'Sistema' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
]

export function SeccionApariencia({ id }: { id: string }) {
  const { tema, cambiarTema } = useTema()

  return (
    <SeccionAjustes
      id={id}
      titulo="Apariencia"
      descripcion="Se guarda en este navegador, no en tu cuenta: podés tener el escritorio en claro y el celular en oscuro."
    >
      <Segmentado valor={tema} opciones={OPCIONES} onCambiar={cambiarTema} etiqueta="Tema" />
    </SeccionAjustes>
  )
}
