// El historial de la cámara de frío alrededor de la excursión que dibuja el
// gráfico: cadencia de 5 min, la del intervalo de publicación por defecto.
export interface FilaHistorial {
  h: string
  temp: string
  hr: string
  co2: string
  fuera?: boolean
}

export const HISTORIAL: FilaHistorial[] = [
  { h: '17:00', temp: '4,6', hr: '86', co2: '614' },
  { h: '17:05', temp: '5,4', hr: '85', co2: '621' },
  { h: '17:10', temp: '7,1', hr: '83', co2: '627' },
  { h: '17:15', temp: '9,2', hr: '79', co2: '634', fuera: true },
  { h: '17:20', temp: '8,1', hr: '80', co2: '629', fuera: true },
  { h: '17:25', temp: '6,4', hr: '83', co2: '620' },
  { h: '17:30', temp: '4,9', hr: '85', co2: '615' },
]
