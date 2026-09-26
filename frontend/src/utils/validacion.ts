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

const passwordNueva = z.string().min(8, 'Mínimo 8 caracteres.').max(128, 'Máximo 128 caracteres.')

export const esquemaRegistro = z
  .object({
    nombre: z.string().trim().min(2, 'Ingresá tu nombre.').max(80, 'Máximo 80 caracteres.'),
    email,
    password: passwordNueva,
    confirmar: z.string().min(1, 'Repetí la contraseña.'),
  })
  .refine((v) => v.password === v.confirmar, { message: 'No coinciden.', path: ['confirmar'] })

export const esquemaRecuperar = z.object({ email })

export const esquemaNuevaClave = z
  .object({
    password: passwordNueva,
    confirmar: z.string().min(1, 'Repetí la contraseña.'),
  })
  .refine((v) => v.password === v.confirmar, { message: 'No coinciden.', path: ['confirmar'] })

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

export const esquemaIdentificacion = z.object({
  nombre: z.string().trim().min(1, 'Ingresá un nombre.').max(80, 'Máximo 80 caracteres.'),
  ubicacion: z.string().trim().max(120, 'Máximo 120 caracteres.'),
  descripcion: z.string().trim().max(300, 'Máximo 300 caracteres.'),
})

export const esquemaInvitacion = z.object({
  email,
  rol: z.enum(['editor', 'viewer'], { message: 'Elegí un rol.' }),
})

export const esquemaPerfil = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre.').max(80, 'Máximo 80 caracteres.'),
  email,
})

/* El mínimo de 8 rige sólo para la nueva: la actual puede ser más corta que la
   política de hoy, igual que en el login. */
export const esquemaPassword = z
  .object({
    actual: z.string().min(1, 'Ingresá tu contraseña actual.'),
    nueva: z.string().min(8, 'Mínimo 8 caracteres.').max(128, 'Máximo 128 caracteres.'),
    repetir: z.string().min(1, 'Repetí la contraseña nueva.'),
  })
  .refine((v) => v.nueva !== v.actual, {
    message: 'Elegí una distinta de la actual.',
    path: ['nueva'],
  })
  .refine((v) => v.nueva === v.repetir, {
    message: 'Las dos contraseñas tienen que coincidir.',
    path: ['repetir'],
  })
