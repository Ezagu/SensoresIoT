import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, mensajeDeError } from '@/lib/api'
import { MarcoAuth } from './MarcoAuth'

type Estado = 'verificando' | 'ok' | 'error'
type Resultado = { ok: true } | { ok: false; error: string }

const SIN_TOKEN = 'El link no trae token. Pedí uno nuevo desde el inicio de sesión.'

export function Verificar() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    if (!token) return
    let vigente = true
    api
      .post('/auth/verify-email', { token })
      .then(() => vigente && setResultado({ ok: true }))
      .catch((err) => {
        if (!vigente) return
        setResultado({ ok: false, error: mensajeDeError(err, 'No pudimos verificar la cuenta.') })
      })
    return () => {
      vigente = false
    }
  }, [token])

  /* Un link sin token se resuelve en render: el estado guarda sólo el resultado
     de la request, no lo que ya se sabe sin pedir nada. */
  const estado: Estado = !token ? 'error' : resultado === null ? 'verificando' : resultado.ok ? 'ok' : 'error'
  const error = !token ? SIN_TOKEN : resultado && !resultado.ok ? resultado.error : null

  return (
    <MarcoAuth titulo={estado === 'ok' ? 'Cuenta verificada' : 'Verificar cuenta'}>
      {estado === 'verificando' && <p className="text-label-lg text-text-muted">Verificando…</p>}
      {estado === 'ok' && (
        <>
          <p className="text-label-lg text-text-muted">Ya podés iniciar sesión.</p>
          <Link to="/login" className="mt-4 inline-block text-label-lg font-medium text-accent hover:underline">
            Ir a iniciar sesión
          </Link>
        </>
      )}
      {estado === 'error' && (
        <>
          <p role="alert" className="text-label-lg text-danger">
            {error}
          </p>
          <Link to="/login" className="mt-4 inline-block text-label-lg font-medium text-accent hover:underline">
            Volver
          </Link>
        </>
      )}
    </MarcoAuth>
  )
}
