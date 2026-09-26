import { FilaAjuste } from '@/components/ui/FilaAjuste'
import { Segmentado } from '@/components/ui/Segmentado'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'
import { useTema, type Tema } from '@/hooks/usarTema'

const OPCIONES: { valor: Tema; etiqueta: string }[] = [
  { valor: 'oscuro', etiqueta: 'Oscuro' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'sistema', etiqueta: 'Según el sistema' },
]

export function SeccionApariencia({ id }: { id: string }) {
  const { tema, cambiarTema } = useTema()

  return (
    <SeccionAjustes id={id} titulo="Preferencias">
      <FilaAjuste id="fila-tema" titulo="Tema">
        <Segmentado valor={tema} opciones={OPCIONES} onCambiar={cambiarTema} etiqueta="Tema" />
      </FilaAjuste>
    </SeccionAjustes>
  )
}
