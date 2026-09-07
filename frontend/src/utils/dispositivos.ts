import type { Dispositivo, DispositivoDetalle } from '@/tipos'

/* Piso mientras el intervalo real no se conoce: sólo afecta al estado "en
   línea", nunca a los datos. */
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

/* Espeja `dispositivo_service.ROLES_EDICION`. No es control de acceso (el
   backend ya devuelve 403), es no ofrecer un botón que va a fallar. Gobierna
   alertas, identificación e intervalo por igual. La preferencia de
   notificación NO entra acá: es de cualquier rol a propósito. */
const ROLES_EDICION: DispositivoDetalle['rol'][] = ['admin', 'owner', 'editor']

export function puedeEditar(rol: DispositivoDetalle['rol']): boolean {
  return ROLES_EDICION.includes(rol)
}

/* Sólo el dueño (o un admin) invita, cambia rol o revoca acceso: no es una
   variante de "editar", es la única acción que afecta a un tercero. */
export function esDuenio(rol: DispositivoDetalle['rol']): boolean {
  return rol === 'owner' || rol === 'admin'
}

/* CAPACIDAD_BUFFER no viaja por la API: es la constante del firmware
   (esp/programa_base.ino, límite del linker, no de diseño). Aproximación
   deliberada — se redondea y se muestra como "~", nunca como garantía. */
const CAPACIDAD_BUFFER = 6000

export function autonomiaBufferSeg(intervaloSeg: number, cantidadSensores: number): number {
  const sensores = Math.max(1, cantidadSensores)
  return Math.floor(CAPACIDAD_BUFFER / sensores) * intervaloSeg
}

/* En vivo el gráfico trae lecturas más nuevas que `last_seen_at`; en un rango
   histórico son viejas y gana `last_seen_at`. Los puntos vienen ascendentes. */
export function ultimoReporteEfectivo(
  lastSeenAt: string | null,
  sensores: { datos: { puntos: { bucket: string }[] } | null }[],
): string | null {
  let max = lastSeenAt
  for (const sensor of sensores) {
    const puntos = sensor.datos?.puntos
    const ultimo = puntos?.[puntos.length - 1]?.bucket
    if (ultimo && (!max || Date.parse(ultimo) > Date.parse(max))) max = ultimo
  }
  return max
}
