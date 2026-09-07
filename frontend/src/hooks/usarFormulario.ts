import { useState, type ChangeEvent } from 'react'
import type { ZodType } from 'zod'

type Errores<T> = Partial<Record<keyof T, string>>

/* `TEntrada` es siempre texto (lo que vive en los inputs); `TSalida` puede
   diferir por la coerción a número del form de alerta. `validar` devuelve los
   valores parseados, o null dejando los mensajes en `errores`. */
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

  return { valores, errores, campo, fijar, validar }
}
