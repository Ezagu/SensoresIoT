// `x`/`y` ubican el módulo dentro del lienzo del equipo; el dibujo de adentro
// va siempre desde 0,0. El default de cada uno es su posición de catálogo:
// moverlo es tocar ese par y nada más. Ver scripts/acomodar.ts.
export type Props = {
  id?: string
  activo?: boolean
  x?: number
  y?: number
}
