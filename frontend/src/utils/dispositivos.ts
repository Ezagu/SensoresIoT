import type { Estado } from '@/components/ui/MarcaEstado'
import type { DispositivoDetalle, DispositivoResumen } from '@/tipos'
import { medida } from './formato'
import { etiquetaDeTipo, etiquetarSensores } from './sensores'
import {
  duracion,
  ETIQUETA_ESTADO,
  estadoDispositivo,
  lecturaDesactualizada,
  type EstadoDispositivo,
} from './tiempo'

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

export type SituacionEquipo = {
  glifo: Estado
  texto: string
  tono: 'danger' | 'attention' | 'dim' | 'faint'
  /* Cuenta para "N requieren atención". "Con retraso" no: el equipo se pone al
     día solo y el producto no lo trata como falla. */
  requiereAtencion: boolean
}

/* El renglón de un equipo en una línea: qué le pasa, con el dato que lo prueba.
   Lo comparten la barra lateral, el selector mobile y el panel. */
export function situacionDeEquipo(d: DispositivoResumen, ahora: number): SituacionEquipo {
  const conectividad = estadoDispositivo(d, ahora)
  const etiquetas = etiquetarSensores(d.sensores)
  const nombre = (id: string, tipo: string) => etiquetas.get(id)?.etiqueta ?? etiquetaDeTipo(tipo)
  const desde = (iso: string | null) => (iso ? ` · ${duracion(iso, new Date(ahora).toISOString())}` : '')

  if (!d.activo) return { glifo: 'inactivo', texto: 'Desactivado', tono: 'faint', requiereAtencion: false }

  if (d.alertas_disparadas > 0) {
    const s = d.sensores.find((x) => x.disparada)
    const texto = s
      ? `${nombre(s.id, s.tipo_nombre)}${s.ultimo_valor !== null ? ` ${medida(s.ultimo_valor, s.unidad)}` : ''}`
      : 'Alerta disparada'
    return { glifo: 'critico', texto, tono: 'danger', requiereAtencion: true }
  }

  switch (conectividad) {
    case 'nunca':
      return { glifo: 'sin-datos', texto: 'Nunca reportó', tono: 'faint', requiereAtencion: false }
    case 'sin-reportar':
      return { glifo: 'sin-reportar', texto: `Sin reportar${desde(d.last_seen_at)}`, tono: 'faint', requiereAtencion: true }
    case 'con-retraso':
      return { glifo: 'atencion', texto: `Con retraso${desde(d.last_data_at)}`, tono: 'dim', requiereAtencion: false }
  }

  /* En línea pero con un sensor mudo: el equipo habla y ese sensor no manda
     nada (bus caído, sensor desconectado). */
  const mudo = d.sensores.find((s) => lecturaDesactualizada(s.ultimo_at, d.intervalo_efectivo_seg, ahora))
  if (mudo) {
    return {
      glifo: 'atencion',
      texto: `${nombre(mudo.id, mudo.tipo_nombre)} sin lecturas${desde(mudo.ultimo_at)}`,
      tono: 'attention',
      requiereAtencion: true,
    }
  }

  return { glifo: 'normal', texto: 'En orden', tono: 'faint', requiereAtencion: false }
}

export function porNombre(a: DispositivoResumen, b: DispositivoResumen) {
  return nombreDeDispositivo(a.id, a.nombre).localeCompare(nombreDeDispositivo(b.id, b.nombre), 'es')
}
