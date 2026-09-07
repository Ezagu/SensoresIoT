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
  alertas_disparadas: number
  sensores: SensorResumen[]
}

export type PanelResumen = {
  dispositivos: DispositivoResumen[]
}

/* GET /usuarios/{id}/dispositivos. El rol sale directo de la fila de
   usuario_dispositivo del join, sin resolver nada. */
export type DispositivoConRol = Dispositivo & { rol: RolDispositivo }

/* GET /dispositivos/{id}. El rol lo resuelve el backend, así que acá también
   puede ser 'admin'. owner_nombre es null sólo si quedó sin vincular. */
export type DispositivoDetalle = Dispositivo & {
  rol: RolDispositivo | 'admin'
  owner_nombre: string | null
  limites: LimitesDispositivo
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
  activa: boolean
  estado: EstadoAlerta
  estado_desde: string | null
  ultimo_valor: number | null
  ultima_evaluacion_at: string | null
  ultima_notificacion_at: string | null
  created_at: string
}

/* El listado por dispositivo agrega la preferencia del que consulta */
export type AlertaConNotificar = Alerta & { notificar: boolean }

export type AlertaCreatePayload = {
  sensor_id: string
  nombre?: string | null
  condicion: CondicionAlerta
  umbral: number
  histeresis?: number
}

/* Sensor y condición no son editables en el contrato: para cambiarlos hay que
   crear otra regla. */
export type AlertaUpdatePayload = {
  nombre?: string | null
  umbral?: number
  histeresis?: number
  activa?: boolean
}

export type PreferenciaUpdatePayload = { notificar: boolean }

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

export type AccesoCreatePayload = {
  email: string
  rol: RolCompartido
}

export type AccesoUpdatePayload = {
  rol: RolCompartido
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
