import type { Estado } from '@/components/ui/MarcaEstado'
import type { DispositivoDetalle, DispositivoResumen } from '@/tipos'
import { ETIQUETA_ESTADO, type EstadoDispositivo } from './tiempo'

/* El dispositivo puede no tener nombre cargado: el id corto lo distingue del
   resto sin obligar a mostrar un UUID entero. */
export function nombreDeDispositivo(id: string, nombre: string | null) {
  return nombre?.trim() || `Dispositivo ${id.slice(0, 8)}`
}

/* Orden de gravedad y no alfabético de EstadoDispositivo: "sin-reportar" (el
   único estado que manda un mail sin gatear por plan) va segundo, antes que
   "nunca" y muy antes que "con retraso" (que el propio producto no trata como
   falla). Lo comparten las secciones del panel y el roster de la sidebar. */
export const ORDEN_GRAVEDAD: Estado[] = [
  'critico',
  'sin-reportar',
  'sin-datos',
  'atencion',
  'normal',
  'inactivo',
]

/* Una regla sonando gana sobre la conectividad: un equipo en línea que está
   cruzando un umbral no se anuncia como "En línea". */
export function estadoDeFila(
  dispositivo: DispositivoResumen,
  conectividad: EstadoDispositivo,
): { estado: Estado; etiqueta: string } {
  if (!dispositivo.activo) return { estado: 'inactivo', etiqueta: 'Desactivado' }
  if (dispositivo.alertas_disparadas > 0) return { estado: 'critico', etiqueta: 'Alerta disparada' }
  const forma: Record<EstadoDispositivo, Estado> = {
    nunca: 'sin-datos',
    'en-linea': 'normal',
    'con-retraso': 'atencion',
    'sin-reportar': 'sin-reportar',
  }
  return { estado: forma[conectividad], etiqueta: ETIQUETA_ESTADO[conectividad] }
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
