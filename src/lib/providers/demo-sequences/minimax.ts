import type { SnapshotResult } from '../fetch'

// Storyline: Connection healthy
export async function mockFetchMetrics(): Promise<SnapshotResult[]> {
  return [
    { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy' },
    { collectorId: 'response_latency', value: 310, valueText: null, unit: 'ms', status: 'healthy' },
    { collectorId: 'api_calls_24h', value: 842, valueText: null, unit: 'calls', status: 'healthy' },
    { collectorId: 'uptime', value: 99.95, valueText: '99.95%', unit: '%', status: 'healthy' },
  ]
}

export type DemoSnapshot = {
  collectorId: string; value: number | null; valueText: string | null
  unit: string; status: string; hoursAgo: number
}

export const demoSnapshots: DemoSnapshot[] = [
  // 48h ago
  { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'response_latency', value: 290, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'api_calls_24h', value: 720, valueText: null, unit: 'calls', status: 'healthy', hoursAgo: 48 },
  { collectorId: 'uptime', value: 99.98, valueText: '99.98%', unit: '%', status: 'healthy', hoursAgo: 48 },
  // 0h
  { collectorId: 'connection_status', value: null, valueText: 'connected', unit: '', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'response_latency', value: 310, valueText: null, unit: 'ms', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'api_calls_24h', value: 842, valueText: null, unit: 'calls', status: 'healthy', hoursAgo: 0 },
  { collectorId: 'uptime', value: 99.95, valueText: '99.95%', unit: '%', status: 'healthy', hoursAgo: 0 },
]
