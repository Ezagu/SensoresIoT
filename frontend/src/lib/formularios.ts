import { useState, type ChangeEvent } from 'react'
import { z, type ZodType } from 'zod'

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

/* z.coerce.number() por sí solo coerce '' a 0 (Number('') === 0), así que un
   campo vacío pasaba como umbral/histéresis/intervalo válidos en vez de
   marcar error — .min(1) antes del .pipe() rechaza la cadena vacía antes de
   que llegue a coercionarse. */
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

/* Sólo se valida cuando el checkbox "automático" está apagado: encendido
   manda `intervalo_seg: null` sin pasar por acá. */
export const esquemaIntervalo = z.object({
  intervaloSeg: numero('Ingresá un número de segundos.').pipe(
    z
      .number()
      .int('Tiene que ser un número entero.')
      .positive('Tiene que ser mayor a 0.'),
  ),
})

type Errores<T> = Partial<Record<keyof T, string>>

/* Estado + validación de un formulario. `TEntrada` es siempre texto (lo que
   vive en los inputs); `TSalida` puede diferir (coerción a número, enums,
   trim) — necesario para el form de alerta, que parsea umbral/histeresis con
   z.coerce.number(). `validar` devuelve los valores ya parseados o null si
   algo falló, en cuyo caso deja los mensajes por campo en `errores`. */
export function useFormulario<TEntrada extends Record<string, string>, TSalida = TEntrada>(
  // El 2do genérico de ZodType queda abierto (no TEntrada): z.coerce.number()
  // declara su input como `unknown`, no `string`, así que un esquema con
  // campos numéricos coercidos no matchearía TEntrada al pie de la letra
  // aunque en runtime siga recibiendo strings de los inputs sin problema.
  esquema: ZodType<TSalida, any>,
  inicial: TEntrada,
) {
  const [valores, setValores] = useState<TEntrada>(inicial)
  const [errores, setErrores] = useState<Errores<TEntrada>>({})

  function cambiar(nombre: keyof TEntrada) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const valor = e.target.value
      setValores((v) => ({ ...v, [nombre]: valor }))
      // Al tipear se borra el error del campo pero no se revalida: mostrar
      // "mínimo 8 caracteres" mientras se escribe el octavo es ruido.
      setErrores((err) => {
        if (!err[nombre]) return err
        const resto = { ...err }
        delete resto[nombre]
        return resto
      })
    }
  }

  function campo(nombre: keyof TEntrada & string) {
    return {
      id: nombre,
      value: valores[nombre],
      error: errores[nombre],
      onChange: cambiar(nombre),
    }
  }

  // Mismos campos que `campo`, tipado para <select> en vez de <input>
  const campoSelect = campo

  function fijar(nombre: keyof TEntrada, valor: TEntrada[typeof nombre]) {
    setValores((v) => ({ ...v, [nombre]: valor }))
  }

  function validar(): TSalida | null {
    const resultado = esquema.safeParse(valores)
    if (resultado.success) {
      setErrores({})
      return resultado.data
    }

    const nuevos: Errores<TEntrada> = {}
    for (const issue of resultado.error.issues) {
      const nombre = issue.path[0] as keyof TEntrada | undefined
      if (nombre !== undefined && !nuevos[nombre]) nuevos[nombre] = issue.message
    }
    setErrores(nuevos)

    // El id del campo es su nombre; sin el foco, en mobile el primer error
    // puede quedar arriba de la pantalla y el usuario no ve por qué no envía.
    const primero = Object.keys(nuevos)[0]
    if (primero) document.getElementById(primero)?.focus()
    return null
  }

  return { valores, errores, campo, campoSelect, fijar, validar }
}
