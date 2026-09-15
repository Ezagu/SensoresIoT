import { medida, numero } from '@/utils/formato'
import type { Alerta, CondicionAlerta } from '@/tipos'

export const ETIQUETA_CONDICION = { mayor: 'Mayor a', menor: 'Menor a' } as const

/* Para la comparación de una fila, donde la etiqueta larga no entra. */
export const SIMBOLO_CONDICION: Record<CondicionAlerta, string> = { mayor: '>', menor: '<' }

export function condicionTexto(alerta: Alerta) {
  return `${ETIQUETA_CONDICION[alerta.condicion]} ${alerta.umbral}`
}

/* El umbral es una cifra medida: tipografía de lectura, separada de la
   etiqueta de la condición. La unidad sólo hace falta donde conviven sensores
   de distinto tipo: en el bloque de un sensor ya la dice la pantalla. */
export function CondicionTexto({ alerta, unidad }: { alerta: Alerta; unidad?: string }) {
  return (
    <>
      {ETIQUETA_CONDICION[alerta.condicion]}{' '}
      <span className="num">{unidad ? medida(alerta.umbral, unidad) : numero(alerta.umbral)}</span>
    </>
  )
}
