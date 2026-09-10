import type { Alerta } from '@/tipos'

export const ETIQUETA_CONDICION = { mayor: 'Mayor a', menor: 'Menor a' } as const

export function condicionTexto(alerta: Alerta) {
  return `${ETIQUETA_CONDICION[alerta.condicion]} ${alerta.umbral}`
}
