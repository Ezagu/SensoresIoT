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

type Errores<T> = Partial<Record<keyof T, string>>

/* Estado + validación de un formulario de campos de texto. `validar` devuelve
   los valores ya parseados (nombre y email vienen trimeados) o null si algo
   falló, en cuyo caso deja los mensajes por campo en `errores`. */
export function useFormulario<T extends Record<string, string>>(
  esquema: ZodType<T, T>,
  inicial: T,
) {
  const [valores, setValores] = useState<T>(inicial)
  const [errores, setErrores] = useState<Errores<T>>({})

  function cambiar(nombre: keyof T) {
    return (e: ChangeEvent<HTMLInputElement>) => {
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

  function campo(nombre: keyof T & string) {
    return {
      id: nombre,
      value: valores[nombre],
      error: errores[nombre],
      onChange: cambiar(nombre),
    }
  }

  function validar(): T | null {
    const resultado = esquema.safeParse(valores)
    if (resultado.success) {
      setErrores({})
      return resultado.data
    }

    const nuevos: Errores<T> = {}
    for (const issue of resultado.error.issues) {
      const nombre = issue.path[0] as keyof T | undefined
      if (nombre !== undefined && !nuevos[nombre]) nuevos[nombre] = issue.message
    }
    setErrores(nuevos)

    // El id del campo es su nombre; sin el foco, en mobile el primer error
    // puede quedar arriba de la pantalla y el usuario no ve por qué no envía.
    const primero = Object.keys(nuevos)[0]
    if (primero) document.getElementById(primero)?.focus()
    return null
  }

  return { valores, errores, campo, validar }
}
