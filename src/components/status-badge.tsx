import { Badge } from '@/components/ui/badge'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

const config: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  healthy: { label: '正常', variant: 'default' },
  warning: { label: '警告', variant: 'secondary' },
  critical: { label: '异常', variant: 'destructive' },
  unknown: { label: '未知', variant: 'outline' },
}

export function StatusBadge({ status }: { status: Status }) {
  const { label, variant } = config[status] ?? config.unknown
  return <Badge variant={variant}>{label}</Badge>
}
