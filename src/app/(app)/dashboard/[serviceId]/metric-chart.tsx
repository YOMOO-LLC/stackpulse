'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { MetricType } from '@/lib/providers/types'

interface Snapshot {
  fetched_at: string
  value: number | null
  value_text: string | null
  status: string
}

interface MetricChartProps {
  metricType: MetricType
  snapshots: Snapshot[]
  unit: string
  threshold?: number
  height?: number
}

function formatValue(value: number, metricType: MetricType, unit: string): string {
  if (metricType === 'currency') return `$${value.toFixed(2)}`
  if (metricType === 'percentage') return `${value.toFixed(1)}%`
  return `${value} ${unit}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function MetricChart({ metricType, snapshots, unit, threshold, height = 160 }: MetricChartProps) {
  const data = snapshots
    .filter((s) => s.value !== null)
    .map((s) => ({
      time: new Date(s.fetched_at).getTime(),
      value: s.value as number,
      label: formatTime(s.fetched_at),
    }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No data yet
      </div>
    )
  }

  const tickFormatter = (v: number) => formatValue(v, metricType, unit)

  if (metricType === 'count') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} hide />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} width={45} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
            formatter={(v: number | undefined) => [formatValue(v ?? 0, metricType, unit), unit]}
          />
          <Bar dataKey="value" fill="#10b981" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${metricType}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} hide />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} width={55} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v: number | undefined) => [formatValue(v ?? 0, metricType, unit), '']}
        />
        {threshold !== undefined && (
          <ReferenceLine y={threshold} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
        )}
        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1.5} fill={`url(#grad-${metricType})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
