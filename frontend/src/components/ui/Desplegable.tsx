import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Boton } from '@/components/ui/Boton'
import { IconoChevronAbajo } from '@/components/layout/iconos'

/* Un panel que cuelga de su botón: para controles que casi siempre están en su
   valor por defecto y no merecen ocupar lugar en reposo. No es un menú de
   acciones — lo de adentro es un formulario y se cierra con Escape, con un
   click afuera o con lo que el contenido decida (`cerrar`). */
export function Desplegable({
  etiqueta,
  marcado = false,
  ancho = 'w-72',
  children,
}: {
  etiqueta: string
  /* El control tiene un valor distinto del default: se nota sin abrirlo. */
  marcado?: boolean
  ancho?: string
  children: (cerrar: () => void) => ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!abierto) return

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    /* pointerdown y no click: si el de afuera es otro botón, cerrar en su click
       lo dejaría accionando sobre una posición que ya se movió. */
    const alApuntar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }

    document.addEventListener('keydown', alTeclear)
    document.addEventListener('pointerdown', alApuntar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('pointerdown', alApuntar)
    }
  }, [abierto])

  return (
    <div ref={caja} className="relative">
      <Boton
        type="button"
        variante="sutil"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((v) => !v)}
      >
        {etiqueta}
        {marcado && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-strong" />}
        <IconoChevronAbajo className={`size-3.5 -mr-1.5 transition-transform duration-130 ${abierto ? 'rotate-180' : ''}`} />
      </Boton>

      {abierto && (
        <div
          id={panelId}
          /* Cuelga a la derecha del disparador, salvo en pantallas angostas:
             ahí el disparador está cerca del borde izquierdo y un panel
             alineado a su derecha se saldría de la pantalla. */
          className={`absolute top-full left-0 z-20 mt-1 rounded-card border border-border-control bg-elevated p-4 shadow-overlay sm:right-0 sm:left-auto ${ancho}`}
        >
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  )
}
