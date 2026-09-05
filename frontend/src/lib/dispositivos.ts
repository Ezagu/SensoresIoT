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

/* Espeja `dispositivo_service.ROLES_EDICION`: el backend ya rechaza con 403 a un
   viewer que intente crear, editar o borrar una regla, así que esto no es el
   control de acceso — es no ofrecerle un botón que le va a devolver un error.
   Ojo: la preferencia de notificación (`PUT /alertas/{id}/notificacion`) NO
   entra acá, es de cualquier rol a propósito. Cada usuario decide si quiere los
   mails de un equipo, aunque no lo administre. */
const ROLES_EDICION: DispositivoDetalle['rol'][] = ['admin', 'owner', 'editor']

export function puedeEditarAlertas(rol: DispositivoDetalle['rol']): boolean {
  return ROLES_EDICION.includes(rol)
}

/* En vivo el gráfico trae lecturas más nuevas que el último `last_seen_at`
   conocido. Los puntos vienen ordenados ascendente, así que el último es el más
   reciente; en un rango histórico son viejos y gana `last_seen_at`. */
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
