import type { SnapshotResult } from '../fetch'

// Storyline: Error count 5 -> rising to 42 (Warning state)
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'unresolved_errors', value: 42, valueText: null, unit: 'issues', status: 'warning' },
    { collectorId: 'crash_free_rate', value: 99.2, valueText: null, unit: '%', status: 'healthy' },
    { collectorId: 'events_24h', value: 1840, valueText: null, unit: 'events', status: 'warning' },
    { collectorId: 'p95_latency', value: 480, valueText: null, unit: 'ms', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago -- healthy
  { collectorId: 'unresolved_errors', value: 5, valueText: null, unit: 'issues', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'crash_free_rate', value: 99.8, valueText: null, unit: '%', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'events_24h', value: 420, valueText: null, unit: 'events', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'p95_latency', value: 320, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 48 },
  // 24h ago -- errors rising
  { collectorId: 'unresolved_errors', value: 18, valueText: null, unit: 'issues', status: 'warning', hoursAgo: 24 },
  { collectorId: 'crash_free_rate', value: 99.5, valueText: null, unit: '%', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'events_24h', value: 980, valueText: null, unit: 'events', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'p95_latency', value: 410, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 24 },
  // 0h -- warning
  { collectorId: 'unresolved_errors', value: 42, valueText: null, unit: 'issues', status: 'warning', hoursAgo: 0 },
  { collectorId: 'crash_free_rate', value: 99.2, valueText: null, unit: '%', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'events_24h', value: 1840, valueText: null, unit: 'events', status: 'warning', hoursAgo: 0 },
  { collectorId: 'p95_latency', value: 480, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 0 },
]
