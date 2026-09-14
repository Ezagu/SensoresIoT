import { useEffect, useState } from 'react'
import { cuentaRegresiva } from '@/utils/tiempo'

/* Cuánto falta para el próximo reporte del equipo. Con publicación cada 5 o 15
   minutos el gráfico parece congelado; saber cuándo llega el que viene es lo
   que separa "está lento" de "está funcionando". */
export function ProximoDato({ enSegundos }: { enSegundos: number | null }) {
  /* El backend manda cuánto FALTA, no un instante, así el contador no depende
     de que el reloj del cliente coincida con el del servidor. El vencimiento se
     ancla al momento en que llegó la respuesta. */
  const [vence, setVence] = useState<number | null>(null)
  const [, forzar] = useState(0)

  useEffect(() => {
    setVence(enSegundos == null ? null : Date.now() + enSegundos * 1000)
  }, [enSegundos])

  useEffect(() => {
    if (vence == null) return
    const id = setInterval(() => {
      // Ya vencido: el equipo está atrasado y el poll de estado se encarga.
      if (!document.hidden && Date.now() < vence) forzar((n) => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [vence])

  if (vence == null) return null

  const segundos = Math.max(0, Math.round((vence - Date.now()) / 1000))
  return segundos === 0 ? <>Esperando reporte</> : <>Próximo reporte en {cuentaRegresiva(segundos)}</>
}
