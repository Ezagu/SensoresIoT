// Fuente: Main.dc.html, sección #planes ~línea 1444.
export interface Plan {
  nombre: string
  precio: string
  precioNota?: string
  items: string[]
  destacado?: boolean
}

export const PLANES: Plan[] = [
  {
    nombre: 'Free',
    precio: 'Sin costo',
    items: [
      '15 días de historial visible',
      'Tus datos se siguen guardando completos',
      'Registro configurable hasta cada 5 min',
      '2 alertas por equipo',
      'CSV del período visible',
    ],
  },
  {
    nombre: 'Premium',
    precio: 'A confirmar',
    precioNota: '/ equipo / mes',
    destacado: true,
    items: [
      'Historial completo, sin ventana',
      'Registro configurable hasta cada 1 min',
      'Alertas sin límite',
      'Equipos compartidos con tu gente',
      'Informes',
    ],
  },
]
