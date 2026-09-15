import type { ReactNode } from 'react'
import { intervalo } from '@/utils/formato'
import type { Huecos } from '@/utils/series'

function Clave({ muestra, children }: { muestra: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="flex w-3.5 shrink-0 justify-center">
        {muestra}
      </span>
      {children}
    </span>
  )
}

/* Qué significa cada trazo. Existe sobre todo por dos marcas que sin nombre se
   leen mal: la barra del corte de plan (que parece un dato) y el trazo
   interrumpido (que parece un error de dibujo). */
export function LeyendaGrafico({
  bucketSeg,
  hayUmbral,
  huecos,
  hayCorteDePlan,
}: {
  bucketSeg: number | null
  hayUmbral: boolean
  huecos: Huecos
  hayCorteDePlan: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-note-lg text-text-muted">
      <Clave muestra={<span className="h-0.5 w-3.5 rounded-xs bg-chart-line" />}>
        {bucketSeg === null ? 'lectura' : `promedio cada ${intervalo(bucketSeg)}`}
      </Clave>

      {hayUmbral && (
        <Clave muestra={<span className="h-0 w-3.5 border-t border-dashed border-chart-threshold" />}>
          umbral de la regla
        </Clave>
      )}

      {huecos.faltantes > 0 && (
        <Clave
          muestra={
            <span className="flex w-3.5 items-center justify-between">
              <span className="h-0.5 w-1.25 rounded-xs bg-chart-line" />
              <span className="h-0.5 w-1.25 rounded-xs bg-chart-line" />
            </span>
          }
        >
          trazo cortado:{' '}
          <span className="num">{huecos.faltantes}</span>{' '}
          {huecos.faltantes === 1 ? 'lectura que no llegó' : 'lecturas que no llegaron'}
        </Clave>
      )}

      {hayCorteDePlan && (
        <Clave muestra={<span className="h-3 w-1 rounded-xs bg-accent" />}>
          hasta acá llega tu plan
        </Clave>
      )}
    </div>
  )
}
