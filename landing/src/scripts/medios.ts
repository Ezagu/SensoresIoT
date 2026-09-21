// Helper compartido por las islas que necesitan matchMedia. Fuente:
// Main.dc.html escucharAncho() (~línea 1604), que soporta el addListener
// viejo además de addEventListener.
export const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches

export function observarMedia(query: string, cb: (coincide: boolean) => void): () => void {
  const mq = matchMedia(query)
  cb(mq.matches)
  const listener = (e: MediaQueryList | MediaQueryListEvent) => cb(e.matches)
  // Safari < 14 no tiene addEventListener acá; el fallback es legacy a
  // propósito (mismo resguardo que Main.dc.html:1610).
  if (mq.addEventListener) mq.addEventListener('change', listener)
  else (mq as any).addListener(listener)
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', listener)
    else (mq as any).removeListener(listener)
  }
}
