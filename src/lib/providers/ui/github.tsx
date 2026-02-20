'use client'

import type { CustomDetailViewProps } from './types'

export default function GitHubDetailView({ snapshots, collectors }: CustomDetailViewProps) {
  const rateLimitCollector = collectors.find((c) => c.id === 'rate_limit_remaining')
  const latestRateLimit = [...snapshots]
    .filter((s) => s.collector_id === 'rate_limit_remaining')
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]

  if (!rateLimitCollector || !latestRateLimit?.value) return null

  const max = rateLimitCollector.thresholds?.max ?? 5000
  const remaining = latestRateLimit.value
  const used = max - remaining
  const pct = Math.round((used / max) * 100)

  const barColor =
    pct >= 90 ? 'var(--sp-error)' :
    pct >= 70 ? 'var(--sp-warning)' :
    'var(--sp-success)'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        API Rate Limit Usage
      </p>
      <div className="flex items-center gap-5">
        <div className="flex-1 flex flex-col gap-1.5">
          <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: barColor,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {used.toLocaleString()} used
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {remaining.toLocaleString()} remaining / {max.toLocaleString()} total
            </span>
          </div>
        </div>
        <span
          className="text-2xl font-bold tabular-nums shrink-0"
          style={{ color: barColor }}
        >
          {pct}%
        </span>
      </div>
    </div>
  )
}
