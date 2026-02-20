'use client'

import { useEffect, useState } from 'react'
import type { Collector, CollectorThresholds } from '@/lib/providers/types'
import { createClient } from '@/lib/supabase/client'

interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: string
  fetched_at: string
}

interface MetricSectionProps {
  serviceId: string
  collectors: Collector[]
  snapshots: Snapshot[]
}

function formatValue(value: number | null, valueText: string | null, metricType: string): string {
  if (value !== null) {
    if (metricType === 'currency') return `$${value.toFixed(2)}`
    if (metricType === 'percentage') return `${value.toFixed(1)}%`
    if (value >= 1000) return value.toLocaleString()
    return String(value)
  }
  return valueText ?? '—'
}

function computeHealth(
  value: number,
  thresholds: CollectorThresholds | undefined
): 'healthy' | 'warning' | 'critical' {
  if (!thresholds) return 'healthy'
  const { warning, critical, direction } = thresholds
  if (direction === 'below') {
    if (value <= critical) return 'critical'
    if (value <= warning) return 'warning'
  } else {
    if (value >= critical) return 'critical'
    if (value >= warning) return 'warning'
  }
  return 'healthy'
}

const HEALTH_COLOR: Record<string, string> = {
  healthy:  'var(--sp-success)',
  warning:  'var(--sp-warning)',
  critical: 'var(--sp-error)',
}

export function MetricSection({ serviceId, collectors, snapshots }: MetricSectionProps) {
  const [liveSnapshots, setLiveSnapshots] = useState<Snapshot[]>(snapshots)

  useEffect(() => { setLiveSnapshots(snapshots) }, [snapshots])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`snapshots:${serviceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'metric_snapshots',
        filter: `connected_service_id=eq.${serviceId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>
        setLiveSnapshots((prev) => [...prev, {
          collector_id: row.collector_id as string,
          value: row.value != null ? Number(row.value) : null,
          value_text: (row.value_text as string) ?? null,
          unit: (row.unit as string) ?? null,
          status: row.status as string,
          fetched_at: row.fetched_at as string,
        }])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [serviceId])

  if (collectors.length === 0) return null

  return (
    <div className="flex gap-3.5 flex-wrap">
      {collectors.map((collector) => {
        const collectorSnaps = liveSnapshots
          .filter((s) => s.collector_id === collector.id)
          .sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime())
        const latest = collectorSnaps.at(-1)
        const value = latest?.value ?? null
        const health = value != null ? computeHealth(value, collector.thresholds) : 'healthy'
        const valueColor = collector.thresholds ? HEALTH_COLOR[health] : 'var(--foreground)'

        return (
          <div
            key={collector.id}
            className="flex flex-col gap-2 rounded-xl flex-1 min-w-[160px]"
            style={{
              padding: '18px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              {collector.name}
            </p>
            <p
              className="font-bold leading-none"
              data-health={health}
              style={{ fontSize: '26px', letterSpacing: '-1px', color: valueColor }}
            >
              {formatValue(value, latest?.value_text ?? null, collector.metricType)}
            </p>
            {collector.displayHint === 'progress' && collector.thresholds?.max && value != null && (
              <div
                role="progressbar"
                aria-valuenow={value}
                aria-valuemax={collector.thresholds.max}
                style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginTop: 4 }}
              >
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (value / collector.thresholds.max) * 100)}%`,
                  background: HEALTH_COLOR[health],
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
            {latest?.unit && (
              <p className="text-[11px]" style={{ color: 'var(--sp-text-tertiary)' }}>
                {latest.unit}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
