import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode }

export function Card({ className = '', children, ...props }: Props) {
  return (
    <div
      className={`bg-surface border border-border rounded-[12px] shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
