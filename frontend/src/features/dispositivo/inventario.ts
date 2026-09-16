import type { DispositivoInventario } from '@/tipos'
import { nombreDeDispositivo } from '@/utils/dispositivos'
import { estadoDispositivo, type EstadoDispositivo } from '@/utils/tiempo'

/* 'desactivado' no es un estado de conexión (estadoDispositivo no lo conoce):
   es una baja, y acá se filtra y se ordena como una categoría más. */
export type FiltroInventario = EstadoDispositivo | 'desactivado'

const SIN_TILDE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' }

/* El casing y los acentos no son confiables en nombre/ubicación (mismo criterio
   que utils/sensores.ts): se normalizan antes de buscar. */
export function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/[áéíóúü]/g, (c) => SIN_TILDE[c] ?? c)
}

export function categoriaDe(
  dispositivo: DispositivoInventario,
  ahora: number = Date.now(),
): FiltroInventario {
  if (!dispositivo.activo) return 'desactivado'
  return estadoDispositivo(dispositivo, ahora)
}

/* Orden fijo de exhibición: gravedad primero, la baja al final (no es una
   falla de conexión, no compite con las demás). */
export const CATEGORIAS: FiltroInventario[] = [
  'en-linea',
  'con-retraso',
  'sin-reportar',
  'nunca',
  'desactivado',
]

export function contarPorEstado(
  dispositivos: DispositivoInventario[],
  ahora: number = Date.now(),
): Record<FiltroInventario, number> {
  const conteo = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<FiltroInventario, number>
  for (const d of dispositivos) conteo[categoriaDe(d, ahora)]++
  return conteo
}

export function filtrarDispositivos(
  dispositivos: DispositivoInventario[],
  { texto, estado, ahora = Date.now() }: { texto: string; estado: FiltroInventario | null; ahora?: number },
): DispositivoInventario[] {
  const buscado = normalizarTexto(texto)
  return dispositivos.filter((d) => {
    if (estado && categoriaDe(d, ahora) !== estado) return false
    if (!buscado) return true
    const nombre = normalizarTexto(d.nombre ?? '')
    const ubicacion = normalizarTexto(d.ubicacion ?? '')
    return nombre.includes(buscado) || ubicacion.includes(buscado)
  })
}

export type OrdenInventario = 'nombre' | 'estado' | 'reporte-antiguo' | 'reporte-reciente'

/* Sólo para desempate/orden por gravedad: desactivado no es "peor" que sin
   reportar, es otra cosa, así que va al final y no al frente. */
const PESO_ESTADO: Record<FiltroInventario, number> = {
  'sin-reportar': 0,
  'con-retraso': 1,
  nunca: 2,
  'en-linea': 3,
  desactivado: 4,
}

/* numeric: true separa "Cámara 10" de "Cámara 2" como números, no como texto:
   estos equipos casi siempre se numeran. */
const collator = new Intl.Collator('es-AR', { numeric: true, sensitivity: 'base' })
const porNombre = (a: DispositivoInventario, b: DispositivoInventario) =>
  collator.compare(nombreDeDispositivo(a.id, a.nombre), nombreDeDispositivo(b.id, b.nombre))

/* Sin lectura, el equipo nunca reportó: al ordenar por reporte va como el
   extremo más viejo, nunca en el medio de fechas reales. */
const tiempoReporte = (d: DispositivoInventario) => (d.last_seen_at ? Date.parse(d.last_seen_at) : -Infinity)

export function ordenarDispositivos(
  dispositivos: DispositivoInventario[],
  orden: OrdenInventario,
  ahora: number = Date.now(),
): DispositivoInventario[] {
  const copia = [...dispositivos]
  switch (orden) {
    case 'nombre':
      return copia.sort(porNombre)
    case 'estado':
      return copia.sort(
        (a, b) =>
          PESO_ESTADO[categoriaDe(a, ahora)] - PESO_ESTADO[categoriaDe(b, ahora)] || porNombre(a, b),
      )
    case 'reporte-antiguo':
      return copia.sort((a, b) => tiempoReporte(a) - tiempoReporte(b) || porNombre(a, b))
    case 'reporte-reciente':
      return copia.sort((a, b) => tiempoReporte(b) - tiempoReporte(a) || porNombre(a, b))
  }
}

export const ETIQUETA_ORDEN: Record<OrdenInventario, string> = {
  nombre: 'Nombre (A-Z)',
  estado: 'Estado',
  'reporte-antiguo': 'Último reporte (más viejo)',
  'reporte-reciente': 'Último reporte (más reciente)',
}

export const ETIQUETA_FILTRO: Record<FiltroInventario, string> = {
  'en-linea': 'En línea',
  'con-retraso': 'Con retraso',
  'sin-reportar': 'Sin reportar',
  nunca: 'Nunca reportó',
  desactivado: 'Desactivados',
}
