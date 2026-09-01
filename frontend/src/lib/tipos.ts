/* Tipado espejo de backend/schemas/*.py. Los nombres de campo son los que
   devuelve la API tal cual (español, snake_case): no se renombran acá para que
   un cambio de contrato salte en el type-check y no en runtime. */

export type Rol = 'user' | 'admin'

export type Usuario = {
  id: string
  nombre: string
  email: string
  rol: Rol
  created_at: string
  is_verified: boolean
}

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

/* GET /sensores/{id} sí resuelve el tipo; el listado por dispositivo no. */
export type SensorConTipo = Sensor & {
  tipo_sensor: { nombre: string; unidad: string }
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

export type TipoEvento = 'disparada' | 'normalizada'

export type EventoAlerta = {
  id: string
  alerta_id: string
  tipo: TipoEvento
  valor: number
  medicion_at: string
  detectado_at: string
  /* la lectura llegó >5 min tarde (flush del buffer del equipo) */
  tardio: boolean
  /* destinatarios = 0 significa "no se intentó enviar" (es historia de un lote
     tardío), no un fallo. El fallo parcial es notificados < destinatarios. */
  destinatarios: number
  notificados: number
}

export type EventoAlertaConContexto = EventoAlerta & {
  alerta_nombre: string | null
  condicion: CondicionAlerta
  umbral: number
  dispositivo_id: string
  dispositivo_nombre: string
  tipo_sensor_nombre: string
  tipo_sensor_unidad: string
}

export type PaginaEventos<T> = {
  eventos: T[]
  siguiente_cursor: string | null
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
