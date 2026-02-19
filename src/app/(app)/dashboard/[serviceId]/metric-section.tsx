'use client'

import { useEffect, useState } from 'react'
import type { Collector } from '@/lib/providers/types'
import { StatusDot } from '@/components/status-dot'
import { MetricChart } from './metric-chart'
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

function formatLatestValue(value: number | null, valueText: string | null, metricType: string, unit: string | null): string {
  if (value !== null) {
    if (metricType === 'currency') return `$${value.toFixed(2)}`
    if (metricType === 'percentage') return `${value.toFixed(1)}%`
    return `${value}${unit ? ' ' + unit : ''}`
  }
  return valueText ?? '\u2014'
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  const diffHrs = Math.floor(diffMins / 60)
  return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`
}

export function MetricSection({ serviceId, collectors, snapshots }: MetricSectionProps) {
  const [liveSnapshots, setLiveSnapshots] = useState<Snapshot[]>(snapshots)

  useEffect(() => {
    setLiveSnapshots(snapshots)
  }, [snapshots])

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
        const snap: Snapshot = {
          collector_id: row.collector_id as string,
          value: row.value != null ? Number(row.value) : null,
          value_text: (row.value_text as string) ?? null,
          unit: (row.unit as string) ?? null,
          status: row.status as string,
          fetched_at: row.fetched_at as string,
        }
        setLiveSnapshots((prev) => [...prev, snap])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [serviceId])

  if (collectors.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">METRICS</h2>
        <p className="text-sm text-muted-foreground">No metrics configured for this provider.</p>
      </section>
    )
  }

  const useGrid = collectors.length >= 3
  const chartHeight = useGrid ? 120 : 160

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">METRICS</h2>
      <div className={useGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'}>
        {collectors.map((collector) => {
          const collectorSnaps = liveSnapshots
            .filter((s) => s.collector_id === collector.id)
            .sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime())

          const latest = collectorSnaps.at(-1)
          const status = (latest?.status ?? 'unknown') as 'healthy' | 'warning' | 'critical' | 'unknown'

          return (
            <div key={collector.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{collector.name}</span>
                <StatusDot status={status} showLabel />
              </div>
              <div className="text-2xl font-semibold text-foreground mb-3">
                {formatLatestValue(latest?.value ?? null, latest?.value_text ?? null, collector.metricType, collector.unit)}
              </div>
              <MetricChart
                metricType={collector.metricType}
                snapshots={collectorSnaps}
                unit={collector.unit}
                height={chartHeight}
              />
              {latest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated {timeAgo(latest.fetched_at)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
