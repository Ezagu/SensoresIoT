export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-tile bg-surface-2 ${className}`} aria-hidden="true" />
}
