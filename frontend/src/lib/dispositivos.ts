import type { Dispositivo, DispositivoDetalle } from './tipos'

/* Piso de muestreo mientras el intervalo real todavía no se conoce (antes de
   que cargue el primer gráfico): sólo afecta al estado "en línea", nunca a
   los datos. */
const INTERVALO_FALLBACK_SEG = 60

export function intervaloEfectivo(dispositivo: Dispositivo, pisoPlan: number | undefined) {
  return Math.max(dispositivo.intervalo_configurado_seg ?? 0, pisoPlan ?? INTERVALO_FALLBACK_SEG)
}

/* El dispositivo puede no tener nombre cargado: el id corto lo distingue del
   resto sin obligar a mostrar un UUID entero. */
export function nombreDeDispositivo(id: string, nombre: string | null) {
  return nombre?.trim() || `Dispositivo ${id.slice(0, 8)}`
}

/* Etiqueta de rol para el detalle de dispositivo: 'admin' sólo puede salir
   ahí, nunca de DispositivoConRol (listado del panel). */
export const ETIQUETA_ROL: Record<DispositivoDetalle['rol'], string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Solo lectura',
  admin: 'Administrador',
}

/* En vivo el gráfico trae lecturas más nuevas que last_seen_at (que no se
   pollea). Los puntos vienen ordenados ascendente, así que el último es el más reciente. */
export function ultimoReporteEfectivo(
  dispositivo: Dispositivo,
  sensores: { datos: { puntos: { bucket: string }[] } | null }[],
): string | null {
  let max = dispositivo.last_seen_at
  for (const sensor of sensores) {
    const puntos = sensor.datos?.puntos
    const ultimo = puntos?.[puntos.length - 1]?.bucket
    if (ultimo && (!max || Date.parse(ultimo) > Date.parse(max))) max = ultimo
  }
  return max
}
