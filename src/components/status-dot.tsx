type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

const DOT_COLOR: Record<Status, string> = {
  healthy:  'bg-emerald-500',
  warning:  'bg-amber-500',
  critical: 'bg-red-500',
  unknown:  'bg-zinc-600',
}

const LABEL: Record<Status, string> = {
  healthy:  'Healthy',
  warning:  'Warning',
  critical: 'Critical',
  unknown:  'Unknown',
}

interface StatusDotProps {
  status: Status
  showLabel?: boolean
  className?: string
}

export function StatusDot({ status, showLabel = false, className = '' }: StatusDotProps) {
  const hasPing = status === 'healthy' || status === 'warning'
  const color = DOT_COLOR[status]

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2 shrink-0">
        {hasPing && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${color}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
      </span>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{LABEL[status]}</span>
      )}
    </span>
  )
}
