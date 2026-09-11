import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { AreaTexto, Campo } from '@/components/ui/Campo'
import { TextoError } from '@/components/ui/TextoError'
import { actualizarDispositivo } from '@/services/consultas'
import { mensajeDeError } from '@/services/api'
import { esquemaIdentificacion } from '@/utils/validacion'
import { useFormulario } from '@/hooks/usarFormulario'
import type { DispositivoDetalle } from '@/tipos'
import { SeccionAjustes } from '@/components/ui/SeccionAjustes'

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
    <SeccionAjustes
      titulo="Identificación"
      descripcion="Cómo se ve este equipo en el panel y en el resto de la app."
    >
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Campo etiqueta="Nombre" disabled={!puedeEditar} {...campo('nombre')} />
        <Campo
          etiqueta="Ubicación (opcional)"
          placeholder="Ej: Cámara 2 — Depósito Sur"
          disabled={!puedeEditar}
          {...campo('ubicacion')}
        />
        {/* AreaTexto es <textarea>: su onChange no entra en el tipo que
            `campo()` arma para <input>/<select>, así que se cablea a mano. */}
        <AreaTexto
          id="descripcion"
          etiqueta="Descripción (opcional)"
          value={valores.descripcion}
          error={errores.descripcion}
          onChange={(e) => fijar('descripcion', e.target.value)}
          disabled={!puedeEditar}
        />

        {!puedeEditar && (
          <p className="text-note text-text-faint">Tu rol en este equipo es de solo lectura.</p>
        )}
        {error && <TextoError>{error}</TextoError>}

        {puedeEditar && (
          <div className="mt-1 flex items-center justify-end gap-3">
            {guardadoOk && (
              <span role="status" className="text-note text-ok">
                Guardado.
              </span>
            )}
            <Boton type="submit" disabled={!sucio || enviando}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        )}
      </form>
    </SeccionAjustes>
  )
}
