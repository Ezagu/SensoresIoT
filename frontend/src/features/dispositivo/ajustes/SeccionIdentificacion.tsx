import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { AreaTexto, Campo } from '@/components/ui/Campo'
import { FilaAjuste } from '@/components/ui/FilaAjuste'
import { TextoError } from '@/components/ui/TextoError'
import { actualizarDispositivo } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { esquemaIdentificacion } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'
import type { DispositivoDetalle } from '@/tipos'

/* Nombre, ubicación y descripción: los tres campos de texto del equipo, con un
   solo Guardar que aparece recién cuando hay algo que guardar. */
export function SeccionIdentificacion({
  dispositivo,
  puedeEditar,
  onGuardado,
}: {
  dispositivo: DispositivoDetalle
  puedeEditar: boolean
  onGuardado: () => void
}) {
  const inicial = {
    nombre: dispositivo.nombre ?? '',
    ubicacion: dispositivo.ubicacion ?? '',
    descripcion: dispositivo.descripcion ?? '',
  }
  const { valores, errores, campo, fijar, validar } = useFormulario(esquemaIdentificacion, inicial)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const sucio =
    valores.nombre !== inicial.nombre ||
    valores.ubicacion !== inicial.ubicacion ||
    valores.descripcion !== inicial.descripcion

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setGuardadoOk(false)
    const datos = validar()
    if (!datos) return

    setEnviando(true)
    try {
      await actualizarDispositivo(dispositivo.id, {
        nombre: datos.nombre,
        ubicacion: datos.ubicacion || null,
        descripcion: datos.descripcion || null,
      })
      setGuardadoOk(true)
      onGuardado()
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos guardar los cambios.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col">
      <FilaAjuste id="fila-nombre" titulo="Nombre">
        <div className="max-w-85">
          <Campo etiqueta="Nombre" etiquetaOculta disabled={!puedeEditar} {...campo('nombre')} />
        </div>
      </FilaAjuste>
      <FilaAjuste id="fila-ubicacion" titulo="Ubicación" opcional>
        <div className="max-w-85">
          <Campo
            etiqueta="Ubicación"
            etiquetaOculta
            placeholder="Ej: Cámara 2 — Depósito Sur"
            disabled={!puedeEditar}
            {...campo('ubicacion')}
          />
        </div>
      </FilaAjuste>
      <FilaAjuste id="fila-descripcion" titulo="Descripción" opcional>
        <div className="max-w-85">
          {/* AreaTexto es <textarea>: su onChange no entra en el tipo que
              `campo()` arma para <input>/<select>, así que se cablea a mano. */}
          <AreaTexto
            id="descripcion"
            etiqueta="Descripción"
            etiquetaOculta
            placeholder="Para qué está, quién lo revisa, cualquier dato útil"
            value={valores.descripcion}
            error={errores.descripcion}
            onChange={(e) => fijar('descripcion', e.target.value)}
            disabled={!puedeEditar}
          />
        </div>
      </FilaAjuste>

      {error && <TextoError>{error}</TextoError>}
      {puedeEditar && (sucio || guardadoOk) && (
        <div className="flex items-center justify-end gap-3 border-b border-border py-3">
          {guardadoOk && !sucio && (
            <span role="status" className="text-note text-ok">
              Guardado.
            </span>
          )}
          {sucio && (
            <Boton type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
          )}
        </div>
      )}
    </form>
  )
}
