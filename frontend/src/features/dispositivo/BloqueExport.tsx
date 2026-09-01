import { useState, type SubmitEvent } from 'react'
import { Boton } from '@/components/ui/Boton'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { exportarHistorial } from '@/lib/consultas'
import { mensajeDeErrorBlob } from '@/lib/api'
import { fecha } from '@/lib/tiempo'

/* Descarga = <a download> temporal sobre un blob: la respuesta pide el header
   Authorization (JWT), así que no puede ser una navegación <a href> directa. */
function dispararDescarga(archivo: Blob, nombre: string) {
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function BloqueExport({
  dispositivoId,
  abierto,
  onCerrar,
}: {
  dispositivoId: string
  abierto: boolean
  onCerrar: () => void
}) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [excel, setExcel] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const res = await exportarHistorial(dispositivoId, {
        desde: desde ? new Date(desde) : undefined,
        hasta: hasta ? new Date(hasta) : undefined,
        excel,
      })
      dispararDescarga(res.archivo, res.nombreArchivo)

      const partes = [`Resolución: ${res.resolucion}`]
      if (res.recortado && res.retencionDias !== null) {
        partes.push(`Tu plan sólo exporta los últimos ${res.retencionDias} días (desde ${fecha(res.desdeEfectivo)})`)
      }
    } catch (err) {
      setError(await mensajeDeErrorBlob(err, 'No pudimos generar el export.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Exportar historial">
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <p className="text-note-lg text-text-faint">
          Sin rango exporta el historial completo disponible.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            id="export-desde"
            etiqueta="Desde (opcional)"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <Campo
            id="export-hasta"
            etiqueta="Hasta (opcional)"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-label text-text-muted">
          <input type="checkbox" checked={excel} onChange={(e) => setExcel(e.target.checked)} />
          Compatible con Excel (separador ; y coma decimal)
        </label>

        {error && (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cerrar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Generando…' : 'Exportar CSV'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
