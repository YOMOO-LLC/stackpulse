'use client'

import type { Collector } from '@/lib/providers/types'

interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: string
  fetched_at: string
}

interface RecentSnapshotsPanelProps {
  snapshots: Snapshot[]
  collectors: Collector[]
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  return `${diffHrs}h ago`
}

function formatValue(value: number | null, valueText: string | null): string {
  if (value !== null) {
    if (value >= 1000) return value.toLocaleString()
    return String(value)
  }
  return valueText ?? '—'
}

function dotColor(status: string): string {
  if (status === 'healthy') return 'var(--sp-success)'
  if (status === 'warning') return 'var(--sp-warning)'
  if (status === 'critical') return 'var(--sp-error)'
  return 'var(--muted-foreground)'
}

export function RecentSnapshotsPanel({ snapshots, collectors }: RecentSnapshotsPanelProps) {
  const recent = [...snapshots]
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())
    .slice(0, 8)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--foreground)' }}>
          Recent Metric Snapshots
        </h2>
      </div>

      {/* Snapshot rows */}
      {recent.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No metric data yet.
          </p>
        </div>
      ) : (
        <div>
          {recent.map((snap, i) => {
            const collector = collectors.find((c) => c.id === snap.collector_id)
            return (
              <div
                key={`${snap.collector_id}-${snap.fetched_at}`}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
              >
                {/* Status dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: dotColor(snap.status) }}
                />
                {/* Metric name + time */}
                <div className="flex flex-col flex-1 gap-0.5 min-w-0">
                  <span className="text-sm truncate" style={{ color: 'var(--foreground)' }}>
                    {collector?.name ?? snap.collector_id}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--sp-text-tertiary)' }}>
                    {timeAgo(snap.fetched_at)}
                  </span>
                </div>
                {/* Value */}
                <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--foreground)' }}>
                  {formatValue(snap.value, snap.value_text)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
