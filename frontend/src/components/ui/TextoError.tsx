import type { ReactNode } from 'react'

export function TextoError({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={`text-label text-danger ${className}`}>
      {children}
    </p>
  )
}
