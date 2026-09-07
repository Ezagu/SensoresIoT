import { useState } from 'react'
import type { Ventana } from '@/utils/ventana'

/* Estado de ventana con zoom. La previa se guarda sólo en el primer zoom, así
   "restablecer" siempre vuelve al punto de partida y no a un paso intermedio. */
export function useVentanaConZoom(inicial: Ventana) {
  const [ventana, setVentana] = useState<Ventana>(inicial)
  const [previa, setPrevia] = useState<Ventana | null>(null)

  function elegir(v: Ventana) {
    setPrevia(null)
    setVentana(v)
  }

  function zoomear(desdeMs: number, hastaMs: number) {
    setPrevia((p) => p ?? ventana)
    setVentana({ tipo: 'fechas', desde: new Date(desdeMs), hasta: new Date(hastaMs) })
  }

  function restablecer() {
    if (previa) setVentana(previa)
    setPrevia(null)
  }

  return { ventana, elegir, zoomear, restablecer, hayZoom: previa !== null }
}
