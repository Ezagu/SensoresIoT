// Fuente: Main.dc.html, const defEventos ~línea 1980. El registro de una
// cámara de frío durante una alerta real. tipo alimenta la clase CSS de la
// fila ('' | 'fuera' | 'aviso').
export interface EventoLog {
  h: string
  v: string
  e: string
  tipo: '' | 'fuera' | 'aviso'
}

export const EVENTOS: EventoLog[] = [
  { h: '13:52', v: '4,5 °C', e: 'Normal', tipo: '' },
  { h: '14:07', v: '4,7 °C', e: 'Normal', tipo: '' },
  { h: '14:22', v: '4,6 °C', e: 'Normal', tipo: '' },
  { h: '14:32', v: '4,8 °C', e: 'Normal', tipo: '' },
  { h: '14:37', v: '5,1 °C', e: 'Normal', tipo: '' },
  { h: '14:42', v: '8,9 °C', e: 'Fuera de rango', tipo: 'fuera' },
  { h: '14:43', v: '9,1 °C', e: 'Alerta enviada', tipo: 'aviso' },
  { h: '14:52', v: '8,6 °C', e: 'Fuera de rango', tipo: 'fuera' },
  { h: '15:08', v: '7,4 °C', e: 'Normalizado', tipo: '' },
  { h: '15:23', v: '5,3 °C', e: 'Normal', tipo: '' },
]
