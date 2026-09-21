// Fuente: Main.dc.html, defaults de data-props (línea 1562) sección
// "Textos del estado". Eran perillas del editor de diseño del canvas; acá
// quedan como la fuente de verdad tipada para hero.ts.
export type FaseHero = 'normal' | 'espera' | 'descarga' | 'alerta'

export const TEXTOS_ESTADO: Record<FaseHero, { titulo: string; sub: string }> = {
  normal: { titulo: 'En línea', sub: 'Todo en orden' },
  espera: { titulo: 'Con retraso', sub: 'Esperando a la reconexión' },
  descarga: { titulo: 'Sincronizando', sub: 'Enviando lo que quedó pendiente' },
  alerta: { titulo: 'Alerta', sub: 'Temperatura fuera de rango' },
}
