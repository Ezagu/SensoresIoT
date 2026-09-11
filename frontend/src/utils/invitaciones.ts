import type { Invitacion } from '@/tipos'

/* El backend tiene que exponer /invitacion/:dispositivoId como ruta pública
   de canje; hasta que exista, este link cae en el catch-all de App.tsx. */
export function linkDeInvitacion(dispositivoId: string, token: string): string {
  return `${window.location.origin}/invitacion/${dispositivoId}?token=${token}`
}

export function esLinkGlobal(invitacion: Invitacion): boolean {
  return invitacion.email === null
}

export function estaVencida(invitacion: Invitacion): boolean {
  return new Date(invitacion.expires_at).getTime() <= Date.now()
}

export const COOLDOWN_REGENERAR_MS = 5 * 60 * 1000
