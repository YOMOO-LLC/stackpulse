'use client'

import type { CustomDetailViewProps } from './types'

interface PerfMetrics {
  avgLatencyMs: number | null
  hitRate: number | null
  keyCount: number | null
  dbSizeMb: number | null
}

export default function UpstashRedisDetailView({ snapshots }: CustomDetailViewProps) {
  const perfSnapshot = [...snapshots]
    .filter(s => s.collector_id === 'performance_metrics')
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]

  if (!perfSnapshot?.value_text) return null

  let perf: PerfMetrics
  try {
    perf = JSON.parse(perfSnapshot.value_text)
  } catch {
    return null
  }

  const rows: Array<{ label: string; value: string | null; unit: string }> = [
    { label: 'Avg Latency', value: perf.avgLatencyMs != null ? String(perf.avgLatencyMs) : null, unit: 'ms' },
    { label: 'Hit Rate', value: perf.hitRate != null ? String(perf.hitRate) : null, unit: '%' },
    { label: 'Key Count', value: perf.keyCount != null ? perf.keyCount.toLocaleString() : null, unit: 'keys' },
    { label: 'DB Size', value: perf.dbSizeMb != null ? String(perf.dbSizeMb) : null, unit: 'MB' },
  ]

  const hasData = rows.some(r => r.value !== null)
  if (!hasData) return null

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        Performance Metrics
      </p>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(({ label, value, unit }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-lg p-3"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
            <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
              {value !== null ? `${value} ${unit}` : '\u2014'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
