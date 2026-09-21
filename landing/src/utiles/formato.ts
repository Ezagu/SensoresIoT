// Copiado de frontend/src/utils/formato.ts (mismo patrón Intl.NumberFormat
// es-AR), sin importar del frontend: la landing no depende de la app.
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
  return `${fmt.format(valor)} ${unidad}`
}

/* Fuente: Main.dc.html, const usd = (n) => 'US$ ' + n (~línea 1892). */
export function dinero(valor: number): string {
  return `US$ ${fmtEntero.format(valor)}`
}
