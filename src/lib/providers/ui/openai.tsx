'use client'

import type { CustomDetailViewProps } from './types'

export default function OpenAIDetailView({ snapshots }: CustomDetailViewProps) {
  const modelUsageSnapshot = [...snapshots]
    .filter(s => s.collector_id === 'model_usage')
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]

  if (!modelUsageSnapshot?.value_text) return null

  let modelUsage: Array<{ model: string; requests: number; costUsd: number }> = []
  try {
    modelUsage = JSON.parse(modelUsageSnapshot.value_text)
  } catch {
    return null
  }

  if (modelUsage.length === 0) return null

  const totalRequests = modelUsage.reduce((sum, m) => sum + m.requests, 0)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        Usage by Model
      </p>
      <div className="flex flex-col gap-2">
        {modelUsage.map((m) => {
          const pct = totalRequests > 0 ? Math.round((m.requests / totalRequests) * 100) : 0
          return (
            <div key={m.model} className="flex items-center gap-3">
              <span className="text-xs w-32 shrink-0 truncate" style={{ color: 'var(--muted-foreground)' }}>
                {m.model}
              </span>
              <div className="flex-1" style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--sp-success)', transition: 'width 0.4s ease' }} />
              </div>
              <span className="text-xs tabular-nums w-16 text-right" style={{ color: 'var(--foreground)' }}>
                {m.requests.toLocaleString()} req
              </span>
              <span className="text-xs tabular-nums w-14 text-right" style={{ color: 'var(--muted-foreground)' }}>
                ${m.costUsd.toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
