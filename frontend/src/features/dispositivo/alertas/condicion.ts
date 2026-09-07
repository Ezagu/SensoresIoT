import type { AlertaConNotificar } from '@/tipos'

export const ETIQUETA_CONDICION = { mayor: 'Mayor a', menor: 'Menor a' } as const

export function condicionTexto(alerta: AlertaConNotificar) {
  return `${ETIQUETA_CONDICION[alerta.condicion]} ${alerta.umbral}`
}
