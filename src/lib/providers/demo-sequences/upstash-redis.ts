import type { SnapshotResult } from '../fetch'

// Storyline: Memory 40% -> growing to 68%, approaching threshold
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'daily_commands', value: 284000, valueText: '284K', unit: 'commands', status: 'healthy' },
    { collectorId: 'memory_usage_mb', value: 174, valueText: null, unit: 'MB', status: 'warning' },
    { collectorId: 'connections', value: 24, valueText: null, unit: 'connections', status: 'healthy' },
    { collectorId: 'throughput', value: 3.2, valueText: '3.2 MB/s', unit: 'MB/s', status: 'healthy' },
    { collectorId: 'performance_metrics', value: null, valueText: 'P99: 2.1ms', unit: '', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

// memory_usage_mb: 40% of 256MB = 102MB -> 68% = 174MB
export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago -- healthy (40%)
  { collectorId: 'daily_commands', value: 198000, valueText: '198K', unit: 'commands', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'memory_usage_mb', value: 102, valueText: null, unit: 'MB', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'connections', value: 18, valueText: null, unit: 'connections', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'throughput', value: 2.1, valueText: '2.1 MB/s', unit: 'MB/s', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'performance_metrics', value: null, valueText: 'P99: 1.8ms', unit: '', status: 'healthy', hoursAgo: 48 },
  // 24h ago -- approaching
  { collectorId: 'daily_commands', value: 241000, valueText: '241K', unit: 'commands', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'memory_usage_mb', value: 140, valueText: null, unit: 'MB', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'connections', value: 21, valueText: null, unit: 'connections', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'throughput', value: 2.7, valueText: '2.7 MB/s', unit: 'MB/s', status: 'healthy', hoursAgo: 24 },
  { collectorId: 'performance_metrics', value: null, valueText: 'P99: 1.9ms', unit: '', status: 'healthy', hoursAgo: 24 },
  // 0h -- warning (68%)
  { collectorId: 'daily_commands', value: 284000, valueText: '284K', unit: 'commands', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'memory_usage_mb', value: 174, valueText: null, unit: 'MB', status: 'warning', hoursAgo: 0 },
  { collectorId: 'connections', value: 24, valueText: null, unit: 'connections', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'throughput', value: 3.2, valueText: '3.2 MB/s', unit: 'MB/s', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'performance_metrics', value: null, valueText: 'P99: 2.1ms', unit: '', status: 'healthy', hoursAgo: 0 },
]
