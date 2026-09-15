import { useEffect, useRef, useState } from 'react'
import { Boton } from './Boton'
import { IconoCopiar, IconoTilde } from '@/components/layout/iconos'

/* Copiar al portapapeles con feedback de 2s. `variante="icono"` es el botón
   circular compacto (ID de equipo, token largo); `variante="boton"` es una
   acción más de la fila, junto a Regenerar/Eliminar. */
export function BotonCopiar({
  texto,
  etiqueta,
  variante = 'boton',
}: {
  texto: string
  etiqueta: string
  variante?: 'icono' | 'boton'
}) {
  const [copiado, setCopiado] = useState(false)
  const idRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(idRef.current), [])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      clearTimeout(idRef.current)
      idRef.current = setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles no hay mucho más que ofrecer acá.
    }
  }

  if (variante === 'icono') {
    return (
      <button
        type="button"
        onClick={copiar}
        aria-label={etiqueta}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control text-text-muted transition-colors duration-130 hover:bg-surface-2 hover:text-text active:bg-border"
      >
        {copiado ? <IconoTilde className="size-3.5 text-ok" /> : <IconoCopiar className="size-3.5" />}
      </button>
    )
  }

  return (
    <Boton type="button" variante="texto" onClick={copiar} aria-label={etiqueta}>
      {copiado ? <IconoTilde className="size-3.5 text-ok" /> : <IconoCopiar className="size-3.5" />}
      {copiado ? 'Copiado' : 'Copiar'}
    </Boton>
  )
}
