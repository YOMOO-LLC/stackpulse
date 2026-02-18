import { Badge } from '@/components/ui/badge'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

const config: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  healthy: { label: 'Healthy', variant: 'default' },
  warning: { label: 'Warning', variant: 'secondary' },
  critical: { label: 'Critical', variant: 'destructive' },
  unknown: { label: 'Unknown', variant: 'outline' },
}

export function StatusBadge({ status }: { status: Status }) {
  const { label, variant } = config[status] ?? config.unknown
  return <Badge variant={variant}>{label}</Badge>
}
