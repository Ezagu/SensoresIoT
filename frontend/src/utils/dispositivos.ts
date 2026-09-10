import type { DispositivoDetalle } from '@/tipos'

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
