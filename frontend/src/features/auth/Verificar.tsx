import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, mensajeDeError } from '@/services/api'
import { MarcoAuth } from './MarcoAuth'

type Estado = 'verificando' | 'ok' | 'error'
type Resultado = { ok: true } | { ok: false; error: string }

const SIN_TOKEN = 'El link no trae token. Pedí uno nuevo desde el inicio de sesión.'

export function Verificar() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  /* El backend borra el token al usarlo, así que un segundo POST con el mismo
     token responde 400: se manda una sola vez (StrictMode remonta en dev). */
  const pedidoPara = useRef<string | null>(null)
  useEffect(() => {
    if (!token || pedidoPara.current === token) return
    pedidoPara.current = token
    api
      .post('/auth/verify-email', { token })
      .then(() => setResultado({ ok: true }))
      .catch((err) =>
        setResultado({ ok: false, error: mensajeDeError(err, 'No pudimos verificar la cuenta.') }),
      )
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
