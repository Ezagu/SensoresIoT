/* Espejo de backend/schemas/*.py: los nombres de campo son los de la API tal
   cual, para que un cambio de contrato salte en el type-check y no en runtime. */

export type Rol = 'user' | 'admin'

/* GET /auth/me. nombre y email salen de la fila; rol sale del JWT, que es el
   que efectivamente rige en la autorización hasta que expire el access token. */
export type SesionActual = {
  usuario_id: string
  nombre: string
  email: string
  rol: Rol
}

export type Dispositivo = {
  id: string
  nombre: string | null
  ubicacion: string | null
  descripcion: string | null
  activo: boolean
  last_seen_at: string | null
  first_connected_at: string | null
  /* null = automático: usa el piso del plan del dueño */
  intervalo_configurado_seg: number | null
}

export type RolDispositivo = 'owner' | 'editor' | 'viewer'

/* GET /usuarios/{id}/panel: sensores y última lectura resueltos en el backend. */
export type SensorResumen = {
  id: string
  tipo_sensor_id: number
  tipo_nombre: string
  unidad: string
  ultimo_valor: number | null
  ultimo_at: string | null
  disparada: boolean
}

/* intervalo_efectivo_seg = max(intervalo_configurado_seg, piso del plan del
   DUEÑO): a diferencia del configurado, es exacto para un equipo compartido. */
export type DispositivoResumen = Dispositivo & {
  rol: RolDispositivo
  intervalo_efectivo_seg: number
  online: boolean
  alertas_disparadas: number
  sensores: SensorResumen[]
}

export type PanelResumen = {
  dispositivos: DispositivoResumen[]
}

/* GET /usuarios/{id}/dispositivos. El rol sale directo de la fila de
   usuario_dispositivo del join, sin resolver nada. */
export type DispositivoConRol = Dispositivo & {
  rol: RolDispositivo
  intervalo_efectivo_seg: number
  online: boolean
}

export type SensorInstalado = {
  id: string
  tipo_sensor_id: number
  tipo_nombre: string
  unidad: string
}

/* GET /usuarios/{id}/dispositivos (versión enriquecida, pendiente en el backend).
   La flota como equipos, no como datos: acá no viaja ninguna lectura, por eso no
   reusa DispositivoResumen. */
export type DispositivoInventario = Dispositivo & {
  rol: RolDispositivo
  owner_nombre: string | null
  intervalo_efectivo_seg: number
  online: boolean
  sensores: SensorInstalado[]
  alertas_total: number
  alertas_disparadas: number
  accesos_total: number
}

/* GET /dispositivos/{id}. El rol lo resuelve el backend, así que acá también
   puede ser 'admin'. owner_nombre es null sólo si quedó sin vincular. */
export type DispositivoDetalle = Dispositivo & {
  rol: RolDispositivo | 'admin'
  owner_nombre: string | null
  limites: LimitesDispositivo
  intervalo_efectivo_seg: number
  /* Opt-out de mails de alerta de este equipo. null = admin sin vínculo: no es
     destinatario, así que no se le ofrece el control. */
  notificar: boolean | null
}

/* Lo único que cambia solo mientras se mira un equipo: lo que el detalle pollea. */
export type DispositivoEstado = {
  last_seen_at: string | null
  online: boolean
  alertas_disparadas: number
  /* Segundos hasta el próximo reporte esperado; null = nunca reportó. Es de
     dónde sale la cadencia del poll. */
  siguiente_medicion: number | null
}

/* Salen del plan del DUEÑO del equipo. No confundir con `useSesion().plan`, que
   es el de la cuenta propia y gobierna otras cosas (compartir los equipos
   propios). Un free con acceso a un equipo premium ve acá lo del dueño. */
export type LimitesDispositivo = {
  puede_alertas: boolean
  /* null = sin tope. Se cuenta por dispositivo, no por cuenta ni por sensor. */
  max_alertas: number | null
  /* Piso, no valor fijo: el dueño puede pedir un intervalo más lento. */
  intervalo_minimo_seg: number
  /* Presets que habilita el plan, ya filtrados por el piso. */
  intervalos_disponibles: number[]
}

/* PATCH /dispositivos/{id}/intervalo. El equipo aplica el cambio en su próxima
   conexión, así que viajan el valor pedido y el que rige mientras tanto. */
export type IntervaloActualizado = {
  intervalo_configurado_seg: number | null
  intervalo_efectivo_seg: number
}

export type TipoSensor = {
  id: number
  nombre: string
  unidad: string
}

export type Sensor = {
  id: string
  dispositivo_id: string
  tipo_sensor_id: number
  activo: boolean
  created_at: string
}

export type PuntoGrafico = {
  bucket: string
  promedio: number
  minimo: number
  maximo: number
}

export type DatosGrafico = {
  puntos: PuntoGrafico[]
  resumen: { promedio: number | null; minimo: number | null; maximo: number | null }
  desde_efectivo: string
  /* true = el plan subió el `desde` pedido. No es un error: la respuesta es 200 */
  recortado: boolean
  retencion_dias: number | null
  /* Resolución realmente usada; null = puntos crudos, sin agregar. */
  bucket_seg: number | null
  /* Muestreo esperado del equipo: separa un hueco real del ritmo normal. */
  intervalo_seg: number
}

export type Medicion = {
  time: string
  value: number
}

/* Ojo: el historial trae retencion_dias pero NO recortado ni desde_efectivo.
   El corte por plan se infiere de retencion_dias != null && siguiente_cursor == null */
export type Historial = {
  mediciones: Medicion[]
  siguiente_cursor: string | null
  retencion_dias: number | null
}

export type CondicionAlerta = 'mayor' | 'menor'
export type EstadoAlerta = 'normal' | 'disparada'

export type Alerta = {
  id: string
  sensor_id: string
  creado_por: string | null
  nombre: string | null
  condicion: CondicionAlerta
  umbral: number
  histeresis: number
  muestras_confirmacion: number
  activa: boolean
  estado: EstadoAlerta
  estado_desde: string | null
  ultimo_valor: number | null
  ultima_evaluacion_at: string | null
  ultima_notificacion_at: string | null
  created_at: string
}

export type AlertaCreatePayload = {
  sensor_id: string
  nombre?: string | null
  condicion: CondicionAlerta
  umbral: number
  histeresis?: number
  muestras_confirmacion?: number
}

/* Sensor y condición no son editables en el contrato: para cambiarlos hay que
   crear otra regla. */
export type AlertaUpdatePayload = {
  nombre?: string | null
  umbral?: number
  histeresis?: number
  muestras_confirmacion?: number
  activa?: boolean
}

/* GET /alertas/eventos. Cada transición de una regla, con el contexto que hace
   falta para juzgarla sin abrir el equipo. No trae sensor_id: el log enlaza al
   equipo, no al sensor. */
export type AlertaEvento = {
  id: string
  alerta_id: string
  tipo: 'disparada' | 'normalizada'
  valor: number
  /* El instante de la lectura. `detectado_at` es cuándo la evaluó el servidor:
     en un envío diferido pueden separarse horas, y eso es `tardio`. */
  medicion_at: string
  detectado_at: string
  tardio: boolean
  /* Cuántos iban a recibir el mail y a cuántos se les pudo mandar. De un lote
     sólo se notifica la última transición de cada regla: el resto queda en 0. */
  destinatarios: number
  notificados: number
  alerta_nombre: string | null
  condicion: CondicionAlerta
  umbral: number
  dispositivo_id: string
  dispositivo_nombre: string
  tipo_sensor_nombre: string
  tipo_sensor_unidad: string
}

export type EventosAlerta = {
  eventos: AlertaEvento[]
  siguiente_cursor: string | null
}

export type NotificacionUpdatePayload = { notificar: boolean }

/* PATCH /dispositivos/{id}. Sólo identificación: intervalo tiene su propio
   endpoint y accesos el suyo, cada uno con su propia autorización. */
export type DispositivoUpdatePayload = {
  nombre?: string
  ubicacion?: string | null
  descripcion?: string | null
  activo?: boolean
}

/* 'owner' nunca se manda en el payload de alta: lo asigna /vinculate, y sólo
   puede haber uno por equipo. */
export type RolCompartido = 'editor' | 'viewer'

/* GET /dispositivos/{id}/accesos. Una fila por usuario con acceso, dueño
   incluido, para que la lista no tenga que combinar dos fuentes. */
export type AccesoDispositivo = {
  usuario_id: string
  nombre: string
  email: string
  rol: RolDispositivo
  created_at: string
}

export type AccesoUpdatePayload = {
  rol: RolCompartido
}

/* GET /dispositivos/{id}/invitaciones. email null = link global (uno por
   rol como mucho); con email = invitación dirigida, se consume al aceptarse. */
export type Invitacion = {
  id: string
  dispositivo_id: string
  rol: RolCompartido
  email: string | null
  token: string
  expires_at: string
  created_at: string
  /* null = nunca regenerada: sin cooldown propio, se puede regenerar de
     entrada. El cooldown de 5 min arranca recién en la primera regeneración. */
  regenerado_at: string | null
}

export type InvitacionCreatePayload = {
  rol: RolCompartido
  email?: string | null
}

export type Plan = {
  id: string
  nombre: string
  /* null = ilimitado en los tres */
  dispositivos_incluidos: number | null
  retencion_dias: number | null
  intervalo_minimo_seg: number
  puede_alertas: boolean
  max_alertas: number | null
  puede_compartir: boolean
  puede_exportar: boolean
}

/* estado registra intención y NO define vigencia: "cancelada pero paga hasta el
   30" es un estado normal. Mostrar siempre estado + fin_at juntos. */
export type Suscripcion = {
  id: string
  usuario_id: string
  plan_id: string
  estado: 'activa' | 'cancelada' | 'revocada'
  inicio_at: string
  fin_at: string | null
  cancelada_at: string | null
  origen: string
}

/* suscripcion == null significa free (free es la ausencia de suscripción) */
export type MiPlan = {
  plan: Plan
  suscripcion: Suscripcion | null
}

/* ——— Cuenta ———
   Las preferencias de notificación son por CUENTA y no por equipo: silenciar un
   equipo puntual sigue siendo `usuario_dispositivo.notificar`. Una clave en
   false apaga esa familia de mails en todos lados. */
export type PreferenciasNotificacion = {
  alertas: boolean
  accesos: boolean
  inicio_sesion: boolean
}

export type ClavePreferencia = keyof PreferenciasNotificacion

export type PreferenciasUpdatePayload = Partial<PreferenciasNotificacion>

/* Cambiar el email obliga a verificar la dirección nueva, así que la respuesta
   dice si la sesión quedó pendiente de verificación. */
export type PerfilUpdatePayload = {
  nombre?: string
  email?: string
}

export type PasswordUpdatePayload = {
  password_actual: string
  password_nueva: string
}
