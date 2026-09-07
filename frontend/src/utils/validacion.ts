import { z } from 'zod'

/* Los mensajes viven acá y no en las pantallas: son parte de la regla, no del
   layout. El backend valida lo mismo en schemas/usuario.py. */

const email = z
  .string()
  .trim()
  .min(1, 'Ingresá tu email.')
  .pipe(z.email('Revisá el formato del email.'))

export const esquemaLogin = z.object({
  email,
  // Sin mínimo de largo: una cuenta vieja puede tener una contraseña más corta
  // que la política actual y tiene que poder entrar igual.
  password: z.string().min(1, 'Ingresá tu contraseña.'),
})

export const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre.').max(80, 'Máximo 80 caracteres.'),
  email,
  password: z.string().min(8, 'Mínimo 8 caracteres.').max(128, 'Máximo 128 caracteres.'),
})

/* z.coerce.number() coerce '' a 0, así que un campo vacío pasaría como válido:
   el .min(1) rechaza la cadena vacía antes de que se coercione. */
function numero(mensaje = 'Ingresá un número.') {
  return z.string().trim().min(1, mensaje).pipe(z.coerce.number({ message: mensaje }))
}

/* Sensor y condición no se editan después de creada la regla (el backend ni
   los acepta en el PATCH): este esquema es sólo para el alta. */
export const esquemaAlertaNueva = z.object({
  sensorId: z.string().min(1, 'Elegí un sensor.'),
  nombre: z.string().trim().max(60, 'Máximo 60 caracteres.'),
  condicion: z.enum(['mayor', 'menor'], { message: 'Elegí una condición.' }),
  umbral: numero(),
  histeresis: numero().pipe(z.number().min(0, 'No puede ser negativo.')),
})

export const esquemaAlertaEdicion = z.object({
  nombre: z.string().trim().max(60, 'Máximo 60 caracteres.'),
  umbral: numero(),
  histeresis: numero().pipe(z.number().min(0, 'No puede ser negativo.')),
})

/* Sólo se valida cuando el preset es "Otro": los demás mandan un valor fijo
   sin pasar por acá. Piso y techo vienen del plan del equipo y de la sanidad
   del backend (24 h), así que el esquema se arma por llamada. */
export function esquemaIntervalo(pisoSeg: number, techoSeg = 86400) {
  return z.object({
    intervaloSeg: numero('Ingresá un número de segundos.').pipe(
      z
        .number()
        .int('Tiene que ser un número entero.')
        .min(pisoSeg, `Tu plan no permite bajar de ${pisoSeg} s.`)
        .max(techoSeg, `No puede superar las 24 h (${techoSeg} s).`),
    ),
  })
}

export const esquemaIdentificacion = z.object({
  nombre: z.string().trim().min(1, 'Ingresá un nombre.').max(80, 'Máximo 80 caracteres.'),
  ubicacion: z.string().trim().max(120, 'Máximo 120 caracteres.'),
  descripcion: z.string().trim().max(300, 'Máximo 300 caracteres.'),
})

export const esquemaInvitacion = z.object({
  email,
  rol: z.enum(['editor', 'viewer'], { message: 'Elegí un rol.' }),
})
