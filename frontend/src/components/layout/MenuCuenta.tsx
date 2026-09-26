import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '@/features/auth/sesion'
import { useTema, type Tema } from '@/hooks/usarTema'
import type { Plan } from '@/tipos'

/* Iniciales para el avatar: dos como máximo, y el fallback es una interrogación
   porque el nombre puede no haber llegado todavía. */
export function iniciales(nombre?: string) {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return partes
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

const SIGUIENTE_TEMA: Record<Tema, Tema> = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' }
const ETIQUETA_TEMA: Record<Tema, string> = { sistema: 'Sistema', claro: 'Claro', oscuro: 'Oscuro' }

/* Qué ve y qué no, en una frase: el límite que se nota es el de la ventana, no
   el de lo guardado, y decirlo evita que un downgrade se lea como pérdida. */
function resumenDePlan(plan: Plan) {
  const ventana = plan.retencion_dias === null ? 'Historial completo' : `${plan.retencion_dias} días visibles`
  const reglas =
    !plan.puede_alertas
      ? 'sin reglas de alerta'
      : plan.max_alertas === null
        ? 'reglas ilimitadas'
        : `${plan.max_alertas} ${plan.max_alertas === 1 ? 'regla' : 'reglas'} por equipo`
  const guardado = plan.retencion_dias === null ? '' : ' Todo lo que miden tus equipos se guarda igual.'
  return `${ventana}, ${reglas}.${guardado}`
}

const ITEM =
  'flex h-9.5 w-full items-center gap-2.5 rounded-tile px-3 text-left text-label-lg text-text-muted transition-colors duration-130 hover:bg-border hover:text-text cursor-pointer'

export function MenuCuenta() {
  const { sesion, plan, logout } = useSesion()
  const { tema, cambiarTema } = useTema()
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    const alApuntar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('pointerdown', alApuntar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('pointerdown', alApuntar)
    }
  }, [abierto])

  const cerrar = () => setAbierto(false)

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label="Cuenta"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((v) => !v)}
        className={`ml-1.5 flex size-8.5 cursor-pointer items-center justify-center rounded-full border text-note font-semibold transition-colors duration-130 ${
          abierto ? 'border-accent-border text-text' : 'border-border-control text-text-muted hover:text-text'
        }`}
      >
        {iniciales(sesion?.nombre)}
      </button>

      {abierto && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-30 mt-2.5 w-75 rounded-menu border border-border-control bg-elevated p-2 shadow-overlay"
        >
          <div className="border-b border-border px-3 pt-3 pb-3.5">
            <b className="block truncate text-body-lg font-semibold">{sesion?.nombre ?? 'Mi cuenta'}</b>
            <span className="block truncate text-note-lg text-text-faint">{sesion?.email}</span>
          </div>

          {plan && (
            <div className="my-2 flex flex-col gap-1 rounded-group bg-border p-3">
              <div className="flex items-baseline justify-between gap-3">
                <b className="text-body-lg font-semibold">Plan {plan.plan.nombre}</b>
                <Link
                  to="/plan"
                  onClick={cerrar}
                  className="text-body font-medium text-accent transition-colors duration-130 hover:text-text"
                >
                  Ver planes
                </Link>
              </div>
              <p className="text-note-lg leading-normal text-text-muted">{resumenDePlan(plan.plan)}</p>
            </div>
          )}

          <Link to="/ajustes" onClick={cerrar} className={ITEM}>
            Ajustes de la cuenta
          </Link>
          <button type="button" onClick={() => cambiarTema(SIGUIENTE_TEMA[tema])} className={ITEM}>
            Tema
            <span className="ml-auto text-note text-text-faint">{ETIQUETA_TEMA[tema]}</span>
          </button>
          <hr className="my-1.5 border-t border-border" />
          <button
            type="button"
            onClick={() => {
              cerrar()
              void logout()
            }}
            className={ITEM}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
