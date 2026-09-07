const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const fmtEntero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

export function numero(valor: number): string {
  return fmt.format(valor)
}

export function entero(valor: number): string {
  return fmtEntero.format(valor)
}

const fmtPorDecimales = new Map<number, Intl.NumberFormat>()

/* Decimales fijos para ejes: "1.016" y "1.015,8" alternados no se leen como una
   escala, y los formatters de arriba recortan a un decimal. */
export function numeroCon(valor: number, decimales: number): string {
  let fmt = fmtPorDecimales.get(decimales)
  if (!fmt) {
    fmt = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    fmtPorDecimales.set(decimales, fmt)
  }
  return fmt.format(valor)
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
