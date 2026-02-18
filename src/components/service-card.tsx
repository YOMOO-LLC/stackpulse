import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from './status-badge'

interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  fetched_at: string
}

interface CollectorDisplay {
  id: string
  name: string
  type: string
  snapshot: Snapshot | null
}

interface ServiceCardProps {
  providerName: string
  label: string
  category: string
  collectors: CollectorDisplay[]
  authExpired: boolean
}

function MetricDisplay({ collector }: { collector: CollectorDisplay }) {
  const { snapshot, type, name } = collector
  if (!snapshot) return <p className="text-sm text-muted-foreground">{name}: 暂无数据</p>

  if (type === 'currency') {
    const val = snapshot.value ?? 0
    return (
      <div>
        <p className="text-xs text-muted-foreground">{name}</p>
        <p className={`text-2xl font-bold ${snapshot.status === 'warning' ? 'text-yellow-500' : snapshot.status === 'critical' ? 'text-destructive' : ''}`}>
          ${val.toFixed(2)}
        </p>
      </div>
    )
  }

  if (type === 'percentage') {
    const pct = snapshot.value ?? 0
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{name}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
        <Progress value={pct} className={pct > 95 ? '[&>div]:bg-red-500' : pct > 80 ? '[&>div]:bg-yellow-500' : ''} />
      </div>
    )
  }

  if (type === 'count') {
    return (
      <div>
        <p className="text-xs text-muted-foreground">{name}</p>
        <p className="text-2xl font-bold">
          {snapshot.value?.toLocaleString()}
          {snapshot.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{snapshot.unit}</span>}
        </p>
      </div>
    )
  }

  if (type === 'status') {
    return (
      <div>
        <p className="text-xs text-muted-foreground">{name}</p>
        <StatusBadge status={snapshot.status} />
      </div>
    )
  }

  return null
}

export function ServiceCard({ providerName, label, collectors, authExpired }: ServiceCardProps) {
  const overallStatus = authExpired
    ? 'critical'
    : collectors.some((c) => c.snapshot?.status === 'critical') ? 'critical'
    : collectors.some((c) => c.snapshot?.status === 'warning') ? 'warning'
    : collectors.every((c) => c.snapshot?.status === 'healthy') ? 'healthy'
    : 'unknown'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{label || providerName}</CardTitle>
          <StatusBadge status={overallStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {authExpired && (
          <p className="text-sm text-destructive">需要重新连接</p>
        )}
        {collectors.map((collector) => (
          <MetricDisplay key={collector.id} collector={collector} />
        ))}
        {collectors.every((c) => !c.snapshot) && !authExpired && (
          <p className="text-sm text-muted-foreground">等待首次采集...</p>
        )}
      </CardContent>
    </Card>
  )
}
