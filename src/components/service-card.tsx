import Link from 'next/link'
import { ProviderIcon } from './provider-icon'
import { StatusDot } from './status-dot'
import { Sparkline } from './sparkline'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: Status
  fetched_at: string
}

interface CollectorDisplay {
  id: string
  name: string
  type: string
  snapshot: Snapshot | null
  history?: number[]
}

interface ServiceCardProps {
  id: string
  providerName: string
  providerId: string
  label: string
  category: string
  collectors: CollectorDisplay[]
  authExpired: boolean
}

function MetricDisplay({ collector }: { collector: CollectorDisplay }) {
  const { snapshot, type, name, history = [] } = collector

  if (!snapshot) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">Awaiting first sync...</p>
      </div>
    )
  }

  if (type === 'currency') {
    const val = snapshot.value ?? 0
    const isWarning = snapshot.status === 'warning'
    const isCritical = snapshot.status === 'critical'
    return (
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{name}</p>
          <p className={`text-3xl font-bold font-mono ${
            isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-foreground'
          }`}>
            ${val.toFixed(2)}
          </p>
        </div>
        {history.length > 1 && (
          <Sparkline
            values={history}
            width={72}
            height={28}
            color={isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'}
            className="opacity-80"
          />
        )}
      </div>
    )
  }

  if (type === 'count') {
    return (
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{name}</p>
          <p className="text-3xl font-bold font-mono text-foreground">
            {snapshot.value?.toLocaleString() ?? '—'}
            {snapshot.unit && (
              <span className="text-sm font-normal text-muted-foreground ml-1">{snapshot.unit}</span>
            )}
          </p>
        </div>
        {history.length > 1 && (
          <Sparkline values={history} width={72} height={28} />
        )}
      </div>
    )
  }

  if (type === 'status') {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-1">{name}</p>
        <StatusDot status={snapshot.status} showLabel />
      </div>
    )
  }

  if (type === 'percentage') {
    const pct = snapshot.value ?? 0
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">{name}</span>
          <span className="font-mono">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ServiceCard({ id, providerId, providerName, label, collectors, authExpired }: ServiceCardProps) {
  const overallStatus: Status = authExpired
    ? 'critical'
    : collectors.some((c) => c.snapshot?.status === 'critical') ? 'critical'
    : collectors.some((c) => c.snapshot?.status === 'warning') ? 'warning'
    : collectors.every((c) => c.snapshot?.status === 'healthy') ? 'healthy'
    : 'unknown'

  const lastUpdated = collectors
    .map((c) => c.snapshot?.fetched_at)
    .filter(Boolean)
    .sort()
    .pop()

  return (
    <Link href={`/dashboard/${id}`} className="block bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-all hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProviderIcon providerId={providerId} size={36} />
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-none mb-1">
              {label || providerName}
            </h3>
            <p className="text-xs text-muted-foreground">{providerName}</p>
          </div>
        </div>
        <StatusDot status={overallStatus} showLabel />
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {authExpired && (
          <p className="text-xs text-red-400">Credentials expired — please reconnect</p>
        )}
        {collectors.map((collector) => (
          <MetricDisplay key={collector.id} collector={collector} />
        ))}
      </div>

      {/* Timestamp */}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/50">
          Updated {timeAgo(lastUpdated)}
        </p>
      )}
    </Link>
  )
}
