import type { Alerta } from '@/tipos'

export const ETIQUETA_CONDICION = { mayor: 'Mayor a', menor: 'Menor a' } as const

export function condicionTexto(alerta: Alerta) {
  return `${ETIQUETA_CONDICION[alerta.condicion]} ${alerta.umbral}`
}

/* El umbral es una cifra medida: tipografía de lectura, separada de la
   etiqueta de la condición. */
export function CondicionTexto({ alerta }: { alerta: Alerta }) {
  return (
    <>
      {ETIQUETA_CONDICION[alerta.condicion]} <span className="num">{alerta.umbral}</span>
    </>
  )
}
