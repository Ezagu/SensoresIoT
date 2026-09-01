import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, mensajeDeError } from '@/lib/api'
import { MarcoAuth } from './MarcoAuth'

type Estado = 'verificando' | 'ok' | 'error'

export function Verificar() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [estado, setEstado] = useState<Estado>('verificando')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setEstado('error')
      setError('El link no trae token. Pedí uno nuevo desde el inicio de sesión.')
      return
    }
    let vigente = true
    api
      .post('/auth/verify-email', { token })
      .then(() => vigente && setEstado('ok'))
      .catch((err) => {
        if (!vigente) return
        setError(mensajeDeError(err, 'No pudimos verificar la cuenta.'))
        setEstado('error')
      })
    return () => {
      vigente = false
    }
  }, [token])

  return (
    <MarcoAuth titulo={estado === 'ok' ? 'Cuenta verificada' : 'Verificar cuenta'}>
      {estado === 'verificando' && <p className="text-[12.5px] text-text-muted">Verificando…</p>}
      {estado === 'ok' && (
        <>
          <p className="text-[12.5px] text-text-muted">Ya podés iniciar sesión.</p>
          <Link to="/login" className="mt-4 inline-block text-[12.5px] font-medium text-accent hover:underline">
            Ir a iniciar sesión
          </Link>
        </>
      )}
      {estado === 'error' && (
        <>
          <p role="alert" className="text-[12.5px] text-danger">
            {error}
          </p>
          <Link to="/login" className="mt-4 inline-block text-[12.5px] font-medium text-accent hover:underline">
            Volver
          </Link>
        </>
      )}
    </MarcoAuth>
  )
}
