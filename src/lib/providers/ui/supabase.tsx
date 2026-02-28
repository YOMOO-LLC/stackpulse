'use client'

import type { CustomDetailViewProps } from './types'

const HEALTH_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE_HEALTHY: { label: 'Healthy', color: 'var(--sp-success)' },
  COMING_UP: { label: 'Coming Up', color: 'var(--sp-warning)' },
  UNHEALTHY: { label: 'Unhealthy', color: 'var(--sp-error)' },
  UNKNOWN: { label: 'Unknown', color: 'var(--muted-foreground)' },
}

const SERVICE_IDS = ['db_health', 'auth_health', 'realtime_health', 'storage_health'] as const

export default function SupabaseDetailView({ snapshots, collectors }: CustomDetailViewProps) {
  const healthCollectors = collectors.filter((c) => c.section === 'health')
  if (healthCollectors.length === 0) return null

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        Service Health
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SERVICE_IDS.map((id) => {
          const collector = healthCollectors.find((c) => c.id === id)
          if (!collector) return null

          const latest = [...snapshots]
            .filter((s) => s.collector_id === id)
            .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]

          const rawStatus = latest?.value_text ?? 'UNKNOWN'
          const info = HEALTH_LABELS[rawStatus] ?? HEALTH_LABELS.UNKNOWN

          return (
            <div
              key={id}
              className="flex flex-col gap-2 rounded-lg p-3"
              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {collector.name}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: info.color,
                    flexShrink: 0,
                  }}
                />
                <span className="text-sm font-medium" style={{ color: info.color }}>
                  {info.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
