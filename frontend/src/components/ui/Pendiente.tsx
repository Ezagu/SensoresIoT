import { Pill } from './Pill'

/* Deliberadamente distinto de <Vacio>: "todavía no tenés datos" y "esto no lo
   construimos" son dos cosas que el usuario no puede distinguir si se ven
   igual, y la segunda es una deuda nuestra, no un estado de sus datos. El borde
   punteado y la etiqueta lo dicen antes de leer el texto. */
export function Pendiente({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-border-strong px-5 py-10 text-center">
      <Pill tono="faint">Todavía no construida</Pill>
      <p className="font-medium text-text">{titulo}</p>
      {detalle && <p className="max-w-115 text-label text-text-muted">{detalle}</p>}
    </div>
  )
}
