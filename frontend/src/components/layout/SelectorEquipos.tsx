import { useEffect, useRef, useState } from 'react'
import { Link, useMatch } from 'react-router-dom'
import { MarcaEstado } from '@/components/ui/MarcaEstado'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { IconoCerrar, IconoChevronAbajo, IconoMas } from './iconos'
import { FilasEquipos, FilaTodos, textoAtencion, useCartera } from './ListaEquipos'

/* Debajo de escritorio no hay barra lateral: el equipo en el que se está parado
   pasa a ser un selector que abre la misma lista en una hoja inferior. */
export function SelectorEquipos({ compacto = false }: { compacto?: boolean }) {
  const { filas, atencion, cargando } = useCartera()
  const [abierta, setAbierta] = useState(false)
  const hoja = useRef<HTMLDialogElement>(null)
  const id = useMatch('/dispositivos/:id/*')?.params.id
  const actual = filas.find((f) => f.dispositivo.id === id)

  useEffect(() => {
    const d = hoja.current
    if (!d) return
    if (abierta && !d.open) d.showModal()
    if (!abierta && d.open) d.close()
  }, [abierta])

  const otros = atencion - (actual?.situacion.requiereAtencion ? 1 : 0)

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierta}
        onClick={() => setAbierta(true)}
        className={`flex min-w-0 cursor-pointer items-center border border-border-control bg-sidebar text-left transition-colors duration-130 hover:border-border-strong ${
          compacto
            ? 'h-10 min-w-75 gap-2.5 rounded-group pr-3 pl-3.5'
            : 'h-13 w-full gap-3 rounded-menu px-3.5'
        }`}
      >
        {actual && <MarcaEstado estado={actual.situacion.glifo} latiendo />}
        {compacto ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-body-lg font-semibold">
              {actual
                ? nombreDeDispositivo(actual.dispositivo.id, actual.dispositivo.nombre)
                : 'Todos los equipos'}
            </span>
            {(actual ? otros > 0 : atencion > 0) && (
              <span className="truncate text-note text-danger">
                {actual
                  ? `+${otros} más ${otros === 1 ? 'requiere' : 'requieren'} atención`
                  : textoAtencion(atencion)}
              </span>
            )}
          </span>
        ) : (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-heading font-semibold">
              {actual
                ? nombreDeDispositivo(actual.dispositivo.id, actual.dispositivo.nombre)
                : 'Todos los equipos'}
            </span>
            <span
              className={`truncate text-note ${!actual && atencion > 0 ? 'text-danger' : 'text-text-faint'}`}
            >
              {actual ? 'Cambiar de equipo' : textoAtencion(atencion)}
            </span>
          </span>
        )}
        <IconoChevronAbajo className="ml-auto size-4 shrink-0 text-text-faint" />
      </button>

      <dialog
        ref={hoja}
        aria-labelledby="titulo-equipos"
        onClose={() => setAbierta(false)}
        onCancel={() => setAbierta(false)}
        onClick={(e) => {
          // Fuera del contenido (el ::backdrop) o en cualquier enlace: elegir un
          // equipo, aunque sea en el que ya se está, cierra la hoja.
          if (e.target === hoja.current || (e.target as HTMLElement).closest('a')) setAbierta(false)
        }}
        className="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border-control bg-elevated px-3 pt-2 pb-[max(1.375rem,env(safe-area-inset-bottom))] text-text backdrop:bg-overlay md:mx-auto md:max-w-lg"
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-border-control" />
        <div className="flex items-center justify-between px-2 pt-1 pb-2.5">
          <h2 id="titulo-equipos" className="text-heading-lg">
            Equipos
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setAbierta(false)}
            className="flex size-11 cursor-pointer items-center justify-center rounded-group text-text-muted transition-colors duration-130 hover:bg-border hover:text-text"
          >
            <IconoCerrar className="size-4" />
          </button>
        </div>

        <nav aria-label="Equipos" className="flex flex-col">
          <FilaTodos atencion={atencion} variante="hoja" />
          <div className="mx-3 my-2 h-px bg-border" />
          <FilasEquipos filas={filas} cargando={cargando} variante="hoja" />
        </nav>

        <Link
          to="/vincular"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-tile border border-accent-border text-heading font-medium text-accent transition-colors duration-130 hover:bg-accent-soft"
        >
          <IconoMas className="size-4" />
          Vincular dispositivo
        </Link>
      </dialog>
    </>
  )
}
