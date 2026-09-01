const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const fmtEntero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

export function numero(valor: number): string {
  return fmt.format(valor)
}

export function entero(valor: number): string {
  return fmtEntero.format(valor)
}

/* Las unidades van con espacio duro para que no queden colgadas del número */
export function medida(valor: number, unidad: string): string {
  return `${fmt.format(valor)} ${unidad}`
}

export function intervalo(seg: number): string {
  if (seg % 3600 === 0) return `${seg / 3600} h`
  if (seg % 60 === 0) return `${seg / 60} min`
  return `${seg} s`
}
